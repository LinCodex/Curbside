type AuthAdmin = {
  rpc(
    name: string,
    input: { account_id: string; session_id: string },
  ): PromiseLike<{ data: unknown; error: unknown }>;
  auth: {
    getUser(token: string): Promise<{
      data: {
        user: {
          id: string;
          email?: string;
          email_confirmed_at?: string;
          is_anonymous?: boolean;
        } | null;
      };
      error: unknown;
    }>;
    admin: {
      deleteUser(id: string, softDelete: boolean): Promise<{ error: unknown }>;
    };
  };
};

export type DeletionLanguage = "en" | "zh";

// Wording follows the privacy policy's deletion and retention sections.
export function accountDeletedEmail(
  language: DeletionLanguage,
  email: string,
  supportEmail: string,
) {
  if (language === "zh")
    return {
      subject: "罚单卫士：您的账户已删除",
      message: [
        `按照您的请求，您的罚单卫士账户（${email}）已被永久删除。`,
        "",
        "## 已删除的内容",
        "- 您的登录信息和账户资料",
        "- 已保存的车辆、车辆昵称及相关私人资料",
        "- 显示偏好及条款同意记录",
        "- 新罚单提醒和产品更新邮件订阅，包括待发送的提醒",
        "",
        "## 保留的内容",
        "- 属于纽约市的公开罚单记录",
        "- 其他用户仍在保存的车牌的共享市政历史",
        "- 邮件服务商日志及独立保留的备份，按其各自的保留规则处理",
        "",
        "您将不会再收到罚单卫士的邮件。欢迎随时回来，您可以使用同一邮箱重新注册。",
        "",
        `如果这不是您本人的操作，请联系 [${supportEmail}](mailto:${supportEmail})。`,
      ].join("\n"),
    };
  return {
    subject: "TicketSafe: your account was deleted",
    message: [
      `Your TicketSafe account for ${email} was permanently deleted, as you requested.`,
      "",
      "## What we removed",
      "- Your sign-in and account profile",
      "- Saved cars, their nicknames and private details",
      "- Display preferences and terms acceptance records",
      "- Ticket alert and product update subscriptions, including pending alerts",
      "",
      "## What stays",
      "- Public NYC ticket records, which belong to the city",
      "- Shared city histories for plates other customers still save",
      "- Email provider logs and separately kept backups, under their own retention rules",
      "",
      "You won’t receive any more emails from TicketSafe. You’re welcome back any time with the same email address.",
      "",
      `If you didn’t delete your account, contact [${supportEmail}](mailto:${supportEmail}).`,
    ].join("\n"),
  };
}

// Runs before deletion, while the address is still known; the returned sender
// runs only after deletion succeeds and can never turn it into a failure.
export type DeletionNotice = (
  user: { id: string; email: string },
  language: DeletionLanguage,
) => Promise<(() => Promise<void>) | null>;

// A caller can delete only the identity verified by Supabase, never a body-selected identity.
export function accountDeletionHandler(
  admin: AuthAdmin,
  allowedOrigins: string[],
  prepareNotice?: DeletionNotice,
) {
  return async (request: Request) => {
    const origin = request.headers.get("origin") || "";
    const allowed = allowedOrigins.includes(origin);
    const reply = (data: object, status = 200) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          Vary: "Origin",
          ...(allowed
            ? {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Allow-Headers":
                  "authorization, apikey, content-type, x-client-info",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
              }
            : {}),
        },
      });
    if (!allowed) return reply({ error: "Origin is not allowed" }, 403);
    if (request.method === "OPTIONS") return reply({ ok: true });
    if (request.method !== "POST")
      return reply({ error: "Method is not allowed" }, 405);
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return reply({ error: "Sign in required" }, 401);
    try {
      if (Number(request.headers.get("content-length") || 0) > 1024)
        return reply({ error: "Request is too large" }, 413);
      const raw = await request.text();
      if (raw.length > 1024)
        return reply({ error: "Request is too large" }, 413);
      const body = JSON.parse(raw);
      const {
        data: { user },
        error,
      } = await admin.auth.getUser(token);
      if (error || !user?.email_confirmed_at || user.is_anonymous)
        return reply({ error: "Verified account required" }, 401);
      if (body?.confirmation !== "DELETE_ACCOUNT" || body.userId !== user.id)
        return reply({ error: "Account deletion was not confirmed" }, 400);
      // getUser validates the JWT; also reject a signed-out/revoked session
      // whose otherwise valid JWT has not yet reached its expiry.
      const encoded = token.split(".")[1];
      const claims = JSON.parse(
        atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (!/^[0-9a-f-]{36}$/i.test(claims.session_id || ""))
        return reply(
          { error: "Sign in again before deleting your account" },
          401,
        );
      const session = await admin.rpc("curbside_can_delete_account", {
        account_id: user.id,
        session_id: claims.session_id,
      });
      if (session.error || session.data !== true)
        return reply(
          { error: "Sign in again before deleting your account" },
          401,
        );
      const language: DeletionLanguage = body.language === "zh" ? "zh" : "en";
      const sendNotice =
        prepareNotice && user.email
          ? await prepareNotice({ id: user.id, email: user.email }, language).catch(
              () => null,
            )
          : null;
      // Cascades remove private cars, preferences, and acceptances. The snapshot
      // unsubscribe trigger keeps city histories still saved by other customers.
      const deleted = await admin.auth.admin.deleteUser(user.id, false);
      if (deleted.error)
        return reply({ error: "Account could not be deleted" }, 503);
      let emailed = false;
      if (sendNotice)
        emailed = await sendNotice().then(
          () => true,
          () => false,
        );
      return reply({ ok: true, ...(sendNotice ? { emailed } : {}) });
    } catch {
      return reply({ error: "Account deletion is unavailable" }, 503);
    }
  };
}
