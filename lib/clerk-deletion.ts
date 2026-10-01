export async function deleteClerkAccount({
  confirmation,
  identity,
  deleteUser,
  deleteData,
}: {
  confirmation: unknown;
  identity: { clerkId: string; id: string };
  deleteUser: (id: string) => Promise<unknown>;
  deleteData: (id: string) => Promise<{ error: unknown }>;
}) {
  if (confirmation !== "DELETE_ACCOUNT")
    throw new Error("Confirm account deletion before continuing.");
  // Clerk revokes the identity and its sessions first. The signed webhook retries data cleanup.
  await deleteUser(identity.clerkId);
  const result = await deleteData(identity.id);
  if (result.error)
    throw new Error(
      "Your sign-in account was deleted. Saved data cleanup is pending; please contact support.",
    );
  return { ok: true };
}
