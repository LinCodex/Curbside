import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import sharp from "sharp";
const result = await build({
  entryPoints: ["lib/ticket-email.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const {
  detailedTicketEmail,
  readTicketEmailDetails,
  enrichTicketEmailDetails,
} = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const details = [
  {
    id: "1000000001",
    plate: "DEMO1",
    state: "NY",
    nickname: "<script>alert(1)</script>",
    description: 'NO PARKING <img onerror="x">',
    issued: "2026-10-02",
    due: 65,
    location: {
      label: "41-20 Main Street, Queens",
      precision: "address",
      lat: 40.7574,
      lng: -73.8284,
    },
  },
  {
    id: "1000000002",
    plate: "DEMO1",
    state: "NY",
    nickname: "My car",
    description: "Historical record",
    due: null,
    location: { label: "Location unavailable", precision: "unknown" },
  },
];
test("branded saved-vehicle email escapes public/user text, excludes unknown amounts and attaches a valid map with official payment links", async () => {
  for (const language of ["en", "zh"]) {
    const email = await detailedTicketEmail(
      2,
      language,
      "https://curbside-eta.vercel.app/#garage",
      "https://database.example.invalid/unsubscribe",
      readTicketEmailDetails(details),
    );
    assert.ok(email.html.includes("cid:ticketsafe-map"));
    assert.ok(!email.html.includes("<script>"));
    assert.ok(email.html.includes("&lt;script&gt;"));
    assert.ok(email.text.includes("DEMO1"));
    assert.ok(email.text.includes("1000000001"));
    assert.ok(email.text.includes("65.00"));
    assert.ok(
      email.text.includes("https://a836-citypay.nyc.gov/citypay/Parking"),
    );
    assert.ok(
      email.html.includes(language === "zh" ? "余额未知" : "Balance unknown"),
    );
    assert.ok(
      email.html.includes(language === "zh" ? "部分合计" : "partial total"),
    );
    const image = Buffer.from(email.attachments[0].content, "base64");
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.width, 640);
    assert.equal(metadata.height, 420);
  }
  const unavailable = await detailedTicketEmail(
    1,
    "en",
    "https://tickets.example.invalid",
    "https://database.example.invalid/unsubscribe",
    [
      {
        ...details[1],
        location: { label: "Unknown", precision: "unknown", lat: 0, lng: 0 },
      },
    ],
  );
  assert.equal(unavailable.attachments, undefined);
  assert.ok(unavailable.html.includes("location map is unavailable"));
  await assert.rejects(
    detailedTicketEmail(
      1,
      "en",
      "javascript:alert(1)",
      "https://database.example.invalid/unsubscribe",
      [],
    ),
  );
});
test("location lookup sends only the location, rejects coarse matches and bounds email details to twenty", async () => {
  const source = readTicketEmailDetails([
    {
      ...details[0],
      location: { label: "41-20 Main Street, Queens", precision: "address" },
    },
  ]);
  let request;
  const enriched = await enrichTicketEmailDetails(source, async (url) => {
    request = url.toString();
    return Response.json({
      features: [
        {
          geometry: { type: "Point", coordinates: [-73.828, 40.757] },
          properties: { layer: "borough", label: "Queens" },
        },
      ],
    });
  });
  assert.ok(request.includes("Main"));
  assert.ok(!/DEMO1|1000000001|script/.test(request));
  assert.equal(enriched[0].location.lat, undefined);
  assert.equal(readTicketEmailDetails(Array(25).fill(details[0])).length, 20);
  assert.equal(
    readTicketEmailDetails([{ ...details[0], id: "<script>" }]).length,
    0,
  );
});
