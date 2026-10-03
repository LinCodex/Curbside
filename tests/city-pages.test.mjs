import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const compiled = await build({
  entryPoints: ["lib/city-pages.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { fetchCityPages } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
const source = new URL(
  "https://city.example.invalid/resource/source.json?$where=plate='TEST'",
);
const rows = (n, offset = 0) =>
  Array.from({ length: n }, (_, i) => ({ summons_number: String(offset + i) }));

test("plate histories fetch beyond 1,000 and exactly full pages need an end probe", async () => {
  for (const total of [1000, 1001, 2030]) {
    const offsets = [];
    const result = await fetchCityPages(
      source,
      { "X-App-Token": "fixture" },
      async (url, input) => {
        const offset = Number(url.searchParams.get("$offset"));
        offsets.push(offset);
        assert.equal(url.searchParams.get("$where"), "plate='TEST'");
        assert.equal(url.searchParams.get("$order"), "summons_number,:id");
        assert.equal(input.headers["X-App-Token"], "fixture");
        return Response.json(rows(Math.min(1000, total - offset), offset));
      },
    );
    assert.equal(result.rows.length, total);
    assert.equal(result.ok, true);
    assert.equal(result.truncated, false);
    assert.equal(offsets.length, Math.floor(total / 1000) + 1);
  }
});

test("a failed later page retains earlier records and marks the source incomplete", async () => {
  let calls = 0;
  const result = await fetchCityPages(source, {}, async () =>
    ++calls === 1
      ? Response.json(rows(1000))
      : new Response("unavailable", { status: 503 }),
  );
  assert.equal(result.rows.length, 1000);
  assert.equal(result.ok, false);
  assert.equal(result.truncated, true);
});

test("paging is bounded and invalid city responses do not imply no tickets", async () => {
  let calls = 0;
  const bounded = await fetchCityPages(source, {}, async () => {
    calls++;
    return Response.json(rows(1000));
  });
  assert.equal(calls, 10);
  assert.equal(bounded.rows.length, 10000);
  assert.equal(bounded.truncated, true);
  const invalid = await fetchCityPages(source, {}, async () =>
    Response.json({ error: "city unavailable" }),
  );
  assert.equal(invalid.ok, false);
});
