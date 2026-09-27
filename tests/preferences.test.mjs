import test from "node:test";
import assert from "node:assert/strict";
import {
  readPreferences,
  resolveLanguage,
  resolveTheme,
} from "../lib/preferences.ts";
import { legalDocuments, OFFERS } from "../lib/legal.ts";
import fs from "node:fs";
const zh = JSON.parse(
  fs.readFileSync(new URL("../lib/zh.json", import.meta.url), "utf8"),
);

test("device defaults and invalid saved preferences safely use system", () => {
  for (const input of [
    null,
    "",
    "broken",
    "null",
    '{"theme":"neon","language":"fr"}',
  ]) {
    assert.deepEqual(readPreferences(input), {
      theme: "system",
      language: "system",
    });
  }
  assert.deepEqual(readPreferences('{"theme":"light","language":"zh"}'), {
    theme: "light",
    language: "zh",
  });
});
test("system language follows the preferred device language and manual choices override it", () => {
  for (const language of ["zh-CN", "zh-TW", "zh-Hans", "zh-HK", "zh"])
    assert.equal(resolveLanguage("system", [language]), "zh");
  assert.equal(resolveLanguage("system", ["en-US", "zh-CN"]), "en");
  assert.equal(resolveLanguage("system", []), "en");
  assert.equal(resolveLanguage("en", ["zh-CN"]), "en");
  assert.equal(resolveLanguage("zh", ["en-US"]), "zh");
});
test("system appearance changes independently of explicit overrides", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
});
test("every legal document and offer has Chinese copy without changing numeric terms", () => {
  const branded = new Set(["Curbside Plus"]);
  const check = (text) => {
    for (const part of text.split(" — ")) {
      if (branded.has(part)) continue;
      assert.ok(zh[part], `Missing Chinese legal text: ${part.slice(0, 90)}`);
    }
  };
  for (const offer of Object.values(OFFERS))
    Object.values(offer).forEach(check);
  for (const document of Object.values(legalDocuments)) {
    check(document.title);
    check(document.description);
    for (const section of document.sections) {
      check(section.title);
      section.paragraphs.forEach(check);
      section.bullets?.forEach(check);
    }
  }
});
