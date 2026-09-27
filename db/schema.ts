import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  email: text().notNull(),
  emailVerified: integer("email_verified").notNull().default(0),
  role: text().notNull().default("customer"),
  plan: text().notNull().default("free"),
  planUntil: integer("plan_until").notNull().default(0),
  stripeCustomer: text("stripe_customer"),
  timezone: text().notNull().default("America/New_York"),
  emailAlerts: integer("email_alerts").notNull().default(1),
  phone: text(),
  phoneVerified: integer("phone_verified").notNull().default(0),
  smsConsent: integer("sms_consent").notNull().default(0),
  smsStopped: integer("sms_stopped").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});
export const vehicles = sqliteTable(
  "vehicles",
  {
    id: text().primaryKey(),
    ownerId: text("owner_id").notNull(),
    plate: text().notNull(),
    state: text().notNull(),
    plateType: text("plate_type").notNull().default(""),
    plateKey: text("plate_key").notNull(),
    nickname: text().notNull(),
    attributes: text().notNull().default("{}"),
    monitoring: integer().notNull().default(1),
    createdAt: integer("created_at").notNull(),
    baselineAt: integer("baseline_at"),
    checkedAt: integer("checked_at"),
    nextCheck: integer("next_check").notNull().default(0),
  },
  (t) => [
    uniqueIndex("vehicle_owner_plate").on(t.ownerId, t.plateKey),
    index("vehicles_due").on(t.monitoring, t.nextCheck),
  ],
);
export const observations = sqliteTable(
  "observations",
  {
    id: text().primaryKey(),
    vehicleId: text("vehicle_id").notNull(),
    summons: text().notNull(),
    payload: text().notNull(),
    firstSeen: integer("first_seen").notNull(),
    lastSeen: integer("last_seen").notNull(),
    localStatus: text("local_status"),
  },
  (t) => [
    uniqueIndex("observation_vehicle_summons").on(t.vehicleId, t.summons),
  ],
);
export const cache = sqliteTable(
  "cache",
  {
    key: text().primaryKey(),
    payload: text().notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("cache_expiry").on(t.expiresAt)],
);
export const consents = sqliteTable("consents", {
  id: text().primaryKey(),
  ownerId: text("owner_id").notNull(),
  channel: text().notNull(),
  action: text().notNull(),
  version: text().notNull(),
  createdAt: integer("created_at").notNull(),
});
export const jobs = sqliteTable(
  "jobs",
  {
    id: text().primaryKey(),
    ownerId: text("owner_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    channel: text().notNull(),
    event: text().notNull(),
    payload: text().notNull(),
    status: text().notNull().default("pending"),
    notBefore: integer("not_before").notNull(),
    attempts: integer().notNull().default(0),
    providerId: text("provider_id"),
    leaseUntil: integer("lease_until"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    error: text(),
  },
  (t) => [index("jobs_due").on(t.status, t.notBefore)],
);
export const limits = sqliteTable("limits", {
  key: text().primaryKey(),
  count: integer().notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
});
export const webhooks = sqliteTable("webhooks", {
  id: text().primaryKey(),
  provider: text().notNull(),
  createdAt: integer("created_at").notNull(),
});
export const dealers = sqliteTable(
  "dealers",
  {
    id: text().primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text().notNull(),
    slug: text().notNull(),
    color: text().notNull().default("#91b7ff"),
    capacity: integer().notNull().default(100),
    active: integer().notNull().default(0),
    stripeCustomer: text("stripe_customer"),
  },
  (t) => [
    uniqueIndex("dealer_slug").on(t.slug),
    uniqueIndex("dealer_owner").on(t.ownerId),
  ],
);
export const memberships = sqliteTable(
  "memberships",
  {
    id: text().primaryKey(),
    dealerId: text("dealer_id").notNull(),
    userId: text("user_id").notNull(),
    role: text().notNull().default("staff"),
  },
  (t) => [uniqueIndex("dealer_member").on(t.dealerId, t.userId)],
);
export const invitations = sqliteTable("invitations", {
  token: text().primaryKey(),
  dealerId: text("dealer_id").notNull(),
  expiresAt: integer("expires_at").notNull(),
  claimedBy: text("claimed_by"),
  createdAt: integer("created_at").notNull(),
});
export const sponsorships = sqliteTable(
  "sponsorships",
  {
    id: text().primaryKey(),
    dealerId: text("dealer_id").notNull(),
    ownerId: text("owner_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("sponsor_owner").on(t.ownerId),
    index("sponsor_dealer").on(t.dealerId),
  ],
);
export const cases = sqliteTable(
  "cases",
  {
    id: text().primaryKey(),
    ownerId: text("owner_id").notNull(),
    vehicleId: text("vehicle_id").notNull(),
    summons: text().notNull(),
    facts: text().notNull().default(""),
    draft: text().notNull().default(""),
    version: integer().notNull().default(1),
    approvedVersion: integer("approved_version"),
    partnerId: text("partner_id"),
    status: text().notNull().default("draft"),
    generations: integer().notNull().default(0),
    paid: integer().notNull().default(0),
    tokens: integer().notNull().default(0),
    receiptKey: text("receipt_key"),
    filingReference: text("filing_reference"),
    outcome: text(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("cases_owner").on(t.ownerId),
    index("cases_partner").on(t.partnerId),
  ],
);
export const evidence = sqliteTable(
  "evidence",
  {
    id: text().primaryKey(),
    caseId: text("case_id").notNull(),
    ownerId: text("owner_id").notNull(),
    objectKey: text("object_key").notNull(),
    name: text().notNull(),
    type: text().notNull(),
    size: integer().notNull(),
    hash: text().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("evidence_case").on(t.caseId)],
);
export const partners = sqliteTable("partners", {
  id: text().primaryKey(),
  name: text().notNull(),
  active: integer().notNull().default(0),
  termsVersion: text("terms_version").notNull(),
  instructions: text().notNull(),
  authorizationRequired: text("authorization_required").notNull(),
});
export const health = sqliteTable("health", {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const notificationEvents = sqliteTable("notification_events", {
  key: text().primaryKey(),
  jobId: text("job_id").notNull(),
  createdAt: integer("created_at").notNull(),
});
