import test from "node:test";
import assert from "node:assert/strict";
import {
  isIOSDevice,
  shouldShowInstallGuide,
  pullDistance,
  PULL_THRESHOLD,
} from "../lib/mobile.ts";
import {
  mapboxLocation,
  locationQuery,
  locationRing,
  contextRadius,
  cleanLocationLabel,
  autocorrectAddress,
} from "../lib/map-locations.ts";
import { plateTotals } from "../lib/plate-totals.ts";
test("install guide appears only for a first iOS browser visit", () => {
  assert.ok(isIOSDevice("iPhone", "iPhone", 5));
  assert.ok(isIOSDevice("Desktop Safari", "MacIntel", 5));
  assert.equal(isIOSDevice("Android", "Linux", 5), false);
  assert.equal(shouldShowInstallGuide(true, false, false), true);
  assert.equal(shouldShowInstallGuide(true, true, false), false);
  assert.equal(shouldShowInstallGuide(true, false, true), false);
});
test("pull refresh requires a deliberate vertical pull", () => {
  assert.ok(pullDistance(4, 160) >= PULL_THRESHOLD);
  assert.equal(pullDistance(100, 80), 0);
  assert.equal(pullDistance(0, -100), 0);
  assert.equal(pullDistance(0, 500), 108);
});
test("location matching rejects coarse and wrong-borough matches", () => {
  const original = {
    label: "Main St and 37th Ave Queens",
    precision: "intersection",
  };
  const feature = {
    geometry: { type: "Point", coordinates: [-73.831, 40.762] },
    properties: {
      feature_type: "street",
      coordinates: { accuracy: "intersection" },
      full_address: "Main Street and 37th Avenue, Queens",
    },
  };
  assert.equal(mapboxLocation(original, feature).precision, "intersection");
  assert.equal(
    mapboxLocation(original, {
      ...feature,
      properties: {
        ...feature.properties,
        full_address: "Main Street, Brooklyn",
      },
    }),
    null,
  );
  assert.equal(
    mapboxLocation(original, {
      ...feature,
      properties: {
        ...feature.properties,
        coordinates: { accuracy: "street" },
      },
    }),
    null,
  );
  assert.equal(
    locationQuery("NB WHITESTONE EXPWY at @ 25TH RD Queens"),
    "WHITESTONE EXPWY and 25TH RD Queens, New York, USA",
  );
  assert.equal(
    cleanLocationLabel("F/O 123 5TH AVE Manhattan"),
    "123 5TH AVE Manhattan",
  );
  assert.equal(
    cleanLocationLabel("O/S 456 BROADWAY Manhattan"),
    "456 BROADWAY Manhattan",
  );
  assert.equal(
    autocorrectAddress("F/O 123 5TH AVE Manhattan").changed,
    true,
  );
  assert.equal(
    autocorrectAddress("F/O 123 5TH AVE Manhattan").suggested,
    "123 5TH AVE Manhattan",
  );
});
test("plate totals deduplicate summons, retain missing amounts, and account in cents", () => {
  const one = {
    id: "1",
    due: 50.1,
    payments: 20.2,
    fine: 65,
    penalty: 10,
    interest: 0.3,
    reduction: 5,
  };
  const unknown = {
    id: "2",
    due: null,
    payments: null,
    fine: 30,
    penalty: null,
    interest: null,
    reduction: null,
  };
  const totals = plateTotals([one, one, unknown]);
  assert.deepEqual(totals.owed, { amount: 50.1, known: 1, total: 2 });
  assert.equal(totals.paid.amount, 20.2);
  assert.equal(totals.assessed.amount, 70.3);
  assert.equal(plateTotals([unknown]).owed.amount, null);
  assert.equal(plateTotals([]).assessed.amount, null);
});
test("context rings stay centered and cannot manufacture a missing location", () => {
  assert.equal(locationRing({ label: "Unknown", precision: "unknown" }), null);
  const location = {
    label: "Main Street",
    lat: 40.76,
    lng: -73.83,
    precision: "intersection",
  };
  const ring = locationRing(location);
  assert.equal(contextRadius(location), 150);
  assert.equal(ring.geometry.coordinates[0].length, 33);
  assert.deepEqual(
    ring.geometry.coordinates[0][0],
    ring.geometry.coordinates[0][32],
  );
});
import { ticketOverview } from "../lib/map-overview.ts";

test("overview centers the busiest neighborhood while retaining distant locations", () => {
  const points = [
    { lng: -73.83, lat: 40.76 },
    { lng: -73.831, lat: 40.761 },
    { lng: -73.832, lat: 40.759 },
    { lng: -74.15, lat: 40.58 },
  ];
  const result = ticketOverview(points);
  assert.ok(Math.abs(result.center[0] + 73.831) < 0.001);
  assert.ok(Math.abs(result.center[1] - 40.76) < 0.001);
  for (const p of points) {
    assert.ok(p.lng >= result.bounds[0][0] && p.lng <= result.bounds[1][0]);
    assert.ok(p.lat >= result.bounds[0][1] && p.lat <= result.bounds[1][1]);
  }
  assert.deepEqual(ticketOverview([...points].reverse()), result);
});

test("overview handles empty records and repeated tickets at one location", () => {
  assert.equal(ticketOverview([]), null);
  const point = { lng: -73.83, lat: 40.76 };
  const result = ticketOverview(Array.from({ length: 500 }, () => point));
  assert.ok(Math.abs(result.center[0] - point.lng) < 1e-9);
  assert.ok(Math.abs(result.center[1] - point.lat) < 1e-9);
  assert.ok(result.bounds[0][0] < result.bounds[1][0]);
});
