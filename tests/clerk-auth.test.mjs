import test from "node:test";
import assert from "node:assert/strict";
import { verifiedIdentity } from "../lib/account-identity.ts";
import { deleteClerkAccount } from "../lib/clerk-deletion.ts";
import { importPayload, preflightImport } from "../lib/clerk-import.mjs";
const legacy = "193a2604-3ba1-4b61-9e9a-5276512dc001";
const consent = "2026-09-30T12:00:00.000Z";
const user = {
  id: "user_one",
  externalId: legacy,
  primaryEmailAddressId: "email_one",
  emailAddresses: [
    {
      id: "email_one",
      emailAddress: "one@example.com",
      verification: { status: "verified" },
    },
  ],
  legalAcceptedAt: Date.parse(consent),
};
test("only verified primary email and real Clerk legal acceptance can use an account", () => {
  assert.deepEqual(verifiedIdentity(user), {
    clerkId: user.id,
    legacyId: legacy,
    email: "one@example.com",
    legalAcceptedAt: Date.parse(consent),
  });
  for (const change of [
    { legalAcceptedAt: null },
    { externalId: "user_other" },
    { primaryEmailAddressId: "missing" },
    {
      emailAddresses: [
        { ...user.emailAddresses[0], verification: { status: "unverified" } },
      ],
    },
  ])
    assert.throws(() => verifiedIdentity({ ...user, ...change }));
  // User-editable metadata cannot choose an owner, verified email, or legal acceptance.
  assert.throws(() =>
    verifiedIdentity({
      ...user,
      legalAcceptedAt: null,
      unsafeMetadata: { legalAcceptedAt: 1 },
    }),
  );
});
test("legacy import preserves UUIDs, bcrypt digests, email verification and original consent", () => {
  const hash = "$2a$10$" + "a".repeat(53);
  const payload = importPayload({
    id: legacy,
    email: "one@example.com",
    email_confirmed_at: consent,
    encrypted_password: hash,
    legal_accepted_at: consent,
  });
  assert.equal(payload.external_id, legacy);
  assert.equal(payload.password_digest, hash);
  assert.equal(payload.password_hasher, "bcrypt");
  assert.equal(payload.legal_accepted_at, consent);
  assert.deepEqual(payload.email_address_identification_status, ["verified"]);
  const pending = importPayload({ id: legacy, email: "one@example.com" });
  assert.deepEqual(pending.email_address_identification_status, ["reserved"]);
  assert.equal(pending.legal_accepted_at, undefined);
  assert.throws(() =>
    importPayload({
      id: legacy,
      email: "one@example.com",
      encrypted_password: "plaintext",
    }),
  );
});
test("migration preflight refuses email collisions and conflicting external identities before writes", () => {
  const planned = [
    importPayload({
      id: legacy,
      email: "one@example.com",
      legal_accepted_at: consent,
    }),
  ];
  const existing = {
    external_id: legacy,
    email_addresses: [{ email_address: "ONE@example.com" }],
  };
  assert.doesNotThrow(() => preflightImport(planned, []));
  assert.doesNotThrow(() => preflightImport(planned, [existing]));
  assert.throws(
    () => preflightImport(planned, [{ ...existing, external_id: null }]),
    /Email collision/,
  );
  assert.throws(
    () =>
      preflightImport(planned, [
        {
          ...existing,
          email_addresses: [{ email_address: "someoneelse@example.com" }],
        },
      ]),
    /conflicting identity/,
  );
  assert.throws(
    () => preflightImport(planned, [existing, existing]),
    /conflicting identity/,
  );
});

test("deletion requires explicit confirmation and deletes only the resolved identity", async () => {
  const calls = [];
  const args = {
    identity: { id: legacy, clerkId: "user_one" },
    deleteUser: async (id) => calls.push(["clerk", id]),
    deleteData: async (id) => {
      calls.push(["data", id]);
      return { error: null };
    },
  };
  await assert.rejects(deleteClerkAccount({ ...args, confirmation: false }));
  assert.deepEqual(calls, []);
  assert.deepEqual(
    await deleteClerkAccount({ ...args, confirmation: "DELETE_ACCOUNT" }),
    { ok: true },
  );
  assert.deepEqual(calls, [
    ["clerk", "user_one"],
    ["data", legacy],
  ]);
});
test("a Clerk deletion failure preserves data, and data failures never report success", async () => {
  let cleaned = false;
  const args = {
    confirmation: "DELETE_ACCOUNT",
    identity: { id: legacy, clerkId: "user_one" },
    deleteUser: async () => {
      throw new Error("failed");
    },
    deleteData: async () => {
      cleaned = true;
      return { error: null };
    },
  };
  await assert.rejects(deleteClerkAccount(args));
  assert.equal(cleaned, false);
  await assert.rejects(
    deleteClerkAccount({
      ...args,
      deleteUser: async () => {},
      deleteData: async () => ({ error: true }),
    }),
    /cleanup is pending/,
  );
});
