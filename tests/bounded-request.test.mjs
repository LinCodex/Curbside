import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
const compiled = await build({
  entryPoints: ["lib/bounded-request.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
});
const { withDeadline, boundedFetch } = await import(
  "data:text/javascript;base64," +
    Buffer.from(compiled.outputFiles[0].text).toString("base64")
);
test("startup requests reject stalled work, preserve successful results and original failures", async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 15), /timed out/);
  assert.equal(await withDeadline(Promise.resolve("verified"), 50), "verified");
  await assert.rejects(
    withDeadline(Promise.reject(new Error("unauthorized")), 50),
    /unauthorized/,
  );
});
test("bounded fetch retains the caller's abort signal", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_input, options) => {
    assert.equal(options.signal.aborted, true);
    throw options.signal.reason;
  };
  try {
    const abort = new AbortController();
    abort.abort(new Error("component unmounted"));
    await assert.rejects(
      boundedFetch("https://app.example.invalid", { signal: abort.signal }),
      /component unmounted/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
