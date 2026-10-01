import { after } from "next/server";
import { accountActor } from "@/lib/account-server";
import { savedAccountRequest } from "@/lib/saved-account";
import { refreshSavedSnapshot } from "@/lib/snapshot-refresh";
import { deleteClerkAccount } from "@/lib/clerk-deletion";
import { HttpError, readJson, rate, sameOrigin } from "@/lib/runtime";
export const runtime = "nodejs";
export const maxDuration = 60;
async function handle(request: Request) {
  try {
    sameOrigin(request);
    const { database, clerk, identity } = await accountActor(request);
    await rate("account:" + identity.clerkId, 120, 60_000);
    const path = new URL(request.url).pathname.replace(/^\/api\/app\//, "");
    const input = request.method === "GET" ? {} : await readJson(request);
    if (!input || typeof input !== "object" || Array.isArray(input))
      throw new HttpError(400, "Invalid request.");
    if (path === "account" && request.method === "DELETE") {
      if (input.confirmation !== "DELETE_ACCOUNT")
        throw new HttpError(400, "Confirm account deletion before continuing.");
      const value = await deleteClerkAccount({
        confirmation: input.confirmation,
        identity,
        deleteUser: (id) => clerk.users.deleteUser(id),
        deleteData: async () =>
          await database.rpc("curbside_delete_clerk_account", {
            clerk_id: identity.clerkId,
          }),
      });
      return Response.json(value, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const refresh = /^vehicles\/([0-9a-f-]{36})\/refresh$/i.exec(path);
    if (refresh && request.method === "POST") {
      await rate("snapshot:" + identity.clerkId, 20, 60_000);
      const { data: car, error } = await database
        .from("curbside_vehicles")
        .select("plate,state,plate_type")
        .eq("id", refresh[1])
        .eq("user_id", identity.id)
        .maybeSingle();
      if (error) throw new HttpError(503, "History temporarily unavailable");
      if (!car) throw new HttpError(404, "Vehicle not found.");
      after(() => refreshSavedSnapshot(database, car));
      return Response.json(
        { queued: true },
        { status: 202, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const value = await savedAccountRequest(
      database,
      identity,
      path,
      request.method,
      input,
    );
    return Response.json(value, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    return Response.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : "Account request unavailable. Please try again or contact support.",
      },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
