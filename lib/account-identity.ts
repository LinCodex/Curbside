export type ClerkIdentity = {
  id: string;
  externalId?: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: {
    id: string;
    emailAddress: string;
    verification: { status: string } | null;
  }[];
  legalAcceptedAt: number | null;
};
export function verifiedIdentity(user: ClerkIdentity) {
  const email = user.emailAddresses.find(
    (item) => item.id === user.primaryEmailAddressId,
  );
  if (!email || email.verification?.status !== "verified")
    throw new Error("Verify your email address before continuing.");
  if (!user.legalAcceptedAt)
    throw new Error(
      "Account migration requires a recorded terms acceptance. Please contact support.",
    );
  if (
    user.externalId &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      user.externalId,
    )
  )
    throw new Error("Account migration is incomplete. Please contact support.");
  return {
    clerkId: user.id,
    legacyId: user.externalId || null,
    email: email.emailAddress,
    legalAcceptedAt: user.legalAcceptedAt,
  };
}
