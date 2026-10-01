import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlate,
  plateKey,
  dateOnly,
  mergeTickets,
  applyDeadline,
} from "../lib/domain.ts";
// Isolated unit fixtures never enter the application, database, or UI.
const ticket = (overrides = {}) => ({
  id: "test-summons",
  plate: "UNIT1",
  state: "NY",
  plateType: "PAS",
  description: "Street cleaning",
  code: "21",
  issued: "2026-09-01",
  time: null,
  noticeDate: null,
  agency: null,
  location: { label: "", precision: "unknown" },
  fine: null,
  penalty: null,
  interest: null,
  reduction: null,
  payments: null,
  due: null,
  status: "Unknown",
  image: null,
  vehicle: {},
  sources: ["historical"],
  provenance: {},
  checkedAt: "2026-09-27T12:00:00Z",
  actionDate: null,
  deadlineBasis: null,
  ...overrides,
});
test("plate identities preserve state and optional type ambiguity", () => {
  assert.deepEqual(normalizePlate({ plate: "ab-123 ", state: "NY" }), {
    plate: "AB123",
    state: "NY",
    plateType: "",
  });
  assert.notEqual(
    plateKey({ plate: "AB123", state: "NY", plateType: "" }),
    plateKey({ plate: "AB123", state: "NJ", plateType: "" }),
  );
  assert.notEqual(
    plateKey({ plate: "AB123", state: "NY", plateType: "" }),
    plateKey({ plate: "AB123", state: "NY", plateType: "PAS" }),
  );
  assert.throws(() => normalizePlate({ plate: "A' OR 1=1", state: "NY" }));
});
test("invalid dates remain unknown", () => {
  assert.equal(dateOnly("02/30/2026"), null);
  assert.equal(dateOnly("2026-09-27T00:00:00"), "2026-09-27");
});
test("financial record wins; historical location enriches it without a duplicate", () => {
  const a = ticket({
    due: 65,
    status: "Outstanding",
    sources: ["nc67-uf89"],
    provenance: { due: "nc67-uf89" },
  });
  const b = ticket({
    location: { label: "Actual address", precision: "address" },
    vehicle: { make: "CITY" },
  });
  const merged = mergeTickets([a, b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].due, 65);
  assert.equal(merged[0].status, "Outstanding");
  assert.equal(merged[0].location.label, "Actual address");
  assert.equal(merged[0].provenance.due, "nc67-uf89");
});
test("camera event date is never treated as NOL date", () => {
  const t = applyDeadline(
    ticket({ description: "School zone speed camera", code: "36" }),
  );
  assert.equal(t.actionDate, null);
  assert.equal(
    applyDeadline({ ...t, noticeDate: "2026-09-05" }).actionDate,
    "2026-10-05",
  );
});
