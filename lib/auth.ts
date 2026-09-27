import { createClerkClient, verifyToken } from "@clerk/backend";
import { config, one, run, HttpError } from "./runtime";
export async function actor(req: Request) {
  const e = config();
  if (!e.CLERK_SECRET_KEY)
    throw new HttpError(
      503,
      "Account sign-in is not configured yet. Live plate search is available.",
    );
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new HttpError(401, "Sign in to continue.");
  let jwt: any;
  try {
    jwt = await verifyToken(token, {
      secretKey: e.CLERK_SECRET_KEY,
      authorizedParties: [e.APP_ORIGIN],
    });
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  if (!jwt.sub || jwt.sts === "pending")
    throw new HttpError(401, "Complete account verification.");
  const client = createClerkClient({ secretKey: e.CLERK_SECRET_KEY });
  const u = await client.users.getUser(jwt.sub);
  const email = u.emailAddresses.find((x) => x.id === u.primaryEmailAddressId);
  if (!email || email.verification?.status !== "verified")
    throw new HttpError(403, "Verify your email address before continuing.");
  await run(
    "INSERT INTO users (id,email,email_verified,created_at) VALUES (?,?,1,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,email_verified=1",
    u.id,
    email.emailAddress,
    Date.now(),
  );
  return (await one("SELECT * FROM users WHERE id=?", u.id))!;
}
export async function ownedVehicle(id: string, user: any) {
  const v = await one(
    "SELECT * FROM vehicles WHERE id=? AND owner_id=?",
    id,
    user.id,
  );
  if (!v) throw new HttpError(404, "Vehicle not found.");
  return v;
}
export async function dealerFor(user: any) {
  const d = await one(
    "SELECT d.* FROM dealers d LEFT JOIN memberships m ON m.dealer_id=d.id AND m.user_id=? WHERE d.owner_id=? OR m.user_id=? LIMIT 1",
    user.id,
    user.id,
    user.id,
  );
  if (!d) throw new HttpError(403, "A dealership account is required.");
  return d;
}
