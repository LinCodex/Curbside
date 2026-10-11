import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
const load = async (entry) => {
  const compiled = await build({ entryPoints: [entry], bundle: true, write: false, format: "esm", platform: "node" });
  return import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
};
const { readCachedSetting, writeCachedSetting, settingCacheKey } = await load("lib/settings-cache.ts");
const { PENDING_SAVE_KEY, PENDING_SAVE_TTL, writePendingSave, takePendingSave, clearPendingSave } = await load("lib/pending-save.ts");
const { CHANGELOG, CURRENT_VERSION } = await load("lib/changelog.ts");
const { clampCamera, zoomCamera, panCamera, parseViewBox, MAX_SVG_ZOOM } = await load("lib/svg-camera.ts");
const storage = () => {
  const values = new Map();
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
};

test("email choices are cached per account so a refresh shows them immediately", () => {
  const local = storage();
  assert.equal(readCachedSetting("announcements", "user-a", local), undefined);
  writeCachedSetting("announcements", "user-a", true, local);
  writeCachedSetting("ticket-alerts", "user-a", false, local);
  assert.equal(readCachedSetting("announcements", "user-a", local), true);
  assert.equal(readCachedSetting("ticket-alerts", "user-a", local), false);
  assert.equal(readCachedSetting("announcements", "user-b", local), undefined);
  assert.equal(local.values.get(settingCacheKey("announcements", "user-a")), "1");
  assert.equal(readCachedSetting("announcements", undefined, local), undefined);
  const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.doesNotThrow(() => writeCachedSetting("announcements", "user-a", true, blocked));
  assert.equal(readCachedSetting("announcements", "user-a", blocked), undefined);
});

test("a guest save is resumed once, within a day, with only the plate fields", () => {
  const local = storage();
  writePendingSave(local, { plate: "unit1", state: "NJ", plateType: "PAS", nickname: "ignored" }, 1_000);
  assert.deepEqual(Object.keys(JSON.parse(local.values.get(PENDING_SAVE_KEY))).sort(), ["at", "plate", "plateType", "state"]);
  const pending = takePendingSave(local, 2_000);
  assert.equal(pending.plate, "UNIT1");
  assert.equal(pending.state, "NJ");
  assert.equal(pending.plateType, "PAS");
  assert.equal(takePendingSave(local, 2_000), null);

  writePendingSave(local, { plate: "UNIT2", state: "NY" }, 1_000);
  assert.equal(takePendingSave(local, 1_000 + PENDING_SAVE_TTL + 1), null);
  assert.equal(local.values.has(PENDING_SAVE_KEY), false);

  local.setItem(PENDING_SAVE_KEY, "{not json");
  assert.equal(takePendingSave(local, 2_000), null);
  writePendingSave(local, { plate: "UNIT3", state: "NY" }, 5_000);
  assert.equal(takePendingSave(local, 1_000), null);
  writePendingSave(local, { plate: "UNIT4", state: "NY" }, 1_000);
  clearPendingSave(local);
  assert.equal(takePendingSave(local, 2_000), null);
});

test("release notes match the package version and are bilingual", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(CURRENT_VERSION, pkg.version);
  assert.equal(CHANGELOG[0].version, pkg.version);
  assert.match(readFileSync("CHANGELOG.md", "utf8"), new RegExp(`^## ${pkg.version.replaceAll(".", "\\.")} `, "m"));
  for (const release of CHANGELOG) {
    assert.ok(release.title.en && release.title.zh);
    assert.ok(release.changes.length > 0);
    for (const change of release.changes) assert.ok(change.en && change.zh, change.en);
  }
  const dates = CHANGELOG.map((release) => release.date.slice(0, 10));
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test("backup map zoom keeps the gesture point fixed and the map filling the frame", () => {
  const box = parseViewBox("0 0 1100 1150");
  assert.deepEqual(box, { x: 0, y: 0, width: 1100, height: 1150 });
  const zoomed = zoomCamera({ k: 1, x: 0, y: 0 }, { x: 300, y: 400 }, 2, box);
  assert.equal(zoomed.k, 2);
  assert.equal(300 * zoomed.k + zoomed.x, 300);
  assert.equal(400 * zoomed.k + zoomed.y, 400);
  assert.equal(zoomCamera(zoomed, { x: 0, y: 0 }, 100, box).k, MAX_SVG_ZOOM);
  assert.deepEqual(zoomCamera(zoomed, { x: 300, y: 400 }, 0.1, box), { k: 1, x: 0, y: 0 });
  const panned = panCamera(zoomed, 5000, -5000, box);
  assert.equal(panned.x, 0);
  assert.equal(panned.y, -1150);
  assert.deepEqual(clampCamera({ k: 0.5, x: 20, y: 20 }, box), { k: 1, x: 0, y: 0 });
});

test("ticket details summons image action is bilingual and indicates availability", () => {
  const zh = JSON.parse(readFileSync("lib/zh.json", "utf8"));
  assert.equal(zh["Show summons image"], "显示罚单影像");
  assert.equal(zh["Hide summons image"], "隐藏罚单影像");
  assert.equal(zh["View summons image"], "查看罚单影像");
  assert.equal(zh["View official summons image"], "查看官方罚单影像");
  assert.equal(zh["Summons image: Not available"], "罚单影像：不可用");
  assert.equal(zh["Summons image not available"], "暂无罚单影像");
  assert.ok(zh["Mobile browsers that cannot display embedded PDFs can open the official summons directly."]);

  const curbsideSource = readFileSync("components/curbside.tsx", "utf8");
  assert.match(curbsideSource, /ticket-summons-action/);
  assert.match(curbsideSource, /ticket-summons-preview/);
  assert.match(curbsideSource, /ticket-summons-buttons/);
  assert.match(curbsideSource, /ticket-summons-view/);
  assert.match(curbsideSource, /detail-summons-pill/);
  assert.match(curbsideSource, /selected\.image/);
  assert.match(curbsideSource, /Summons image: Not available/);

  const polishSource = readFileSync("app/polish.css", "utf8");
  assert.match(polishSource, /\.detail-summons-pill/);
  assert.match(polishSource, /\.summons-frame/);
  assert.match(polishSource, /@media \(max-width: 800px\) \{[\s\S]*?\.summons-frame/);
});

test("NYC summons images are accepted and upgraded to https for nyc.gov domains", async () => {
  const { safeImage } = await load("lib/nyc.ts");
  const rawUrl = "http://nycserv.nyc.gov/NYCServWeb/ShowImage?searchID=VDFSSk5FMTZTVEJOVkZrMFRVRTlQUT09&locationName=_____________________";
  const expected = "https://nycserv.nyc.gov/NYCServWeb/ShowImage?searchID=VDFSSk5FMTZTVEJOVkZrMFRVRTlQUT09&locationName=_____________________";
  assert.equal(safeImage(rawUrl), expected);
  assert.equal(safeImage({ url: rawUrl }), expected);
  assert.equal(safeImage({ href: rawUrl }), expected);
  assert.equal(safeImage("https://evil.com/fake.pdf"), null);
  assert.equal(safeImage(null), null);
  assert.equal(safeImage(undefined), null);
});

test("summonsImageUrl encodes summons numbers using NYCServ triple-base64 standard", async () => {
  const { summonsImageUrl } = await load("lib/domain.ts");
  const expected = "https://nycserv.nyc.gov/NYCServWeb/ShowImage?searchID=VDFSSk5FMTZTVEJOVkZrMFRVRTlQUT09&locationName=_____________________";
  assert.equal(summonsImageUrl("9283241680"), expected);
  assert.equal(summonsImageUrl("4876133268"), "https://nycserv.nyc.gov/NYCServWeb/ShowImage?searchID=VGtSbk0wNXFSWHBOZWtreVQwRTlQUT09&locationName=_____________________");
  assert.equal(summonsImageUrl(""), null);
  assert.equal(summonsImageUrl(null), null);
  assert.equal(summonsImageUrl("abc"), null);
  assert.equal(summonsImageUrl("123"), null);
});
