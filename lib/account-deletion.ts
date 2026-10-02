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

// A caller can delete only the identity verified by Supabase, never a body-selected identity.
export function accountDeletionHandler(
  admin: AuthAdmin,
  allowedOrigins: string[],
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
      // Cascades remove private cars, preferences, and acceptances. The snapshot
      // unsubscribe trigger keeps city histories still saved by other customers.
      const deleted = await admin.auth.admin.deleteUser(user.id, false);
      if (deleted.error)
        return reply({ error: "Account could not be deleted" }, 503);
      return reply({ ok: true });
    } catch {
      return reply({ error: "Account deletion is unavailable" }, 503);
    }
  };
}
