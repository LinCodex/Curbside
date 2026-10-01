import test from "node:test";
import assert from "node:assert/strict";
import {
  readPreferences,
  resolveLanguage,
  resolveTheme,
} from "../lib/preferences.ts";
import { legalDocuments } from "../lib/legal.ts";
import fs from "node:fs";
import ts from "typescript";
const zh = JSON.parse(fs.readFileSync(new URL("../lib/zh.json", import.meta.url), "utf8"));

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
      detailMode: "normal",
    });
  }
  assert.deepEqual(readPreferences('{"theme":"light","language":"zh"}'), {
    theme: "light",
    language: "zh",
    detailMode: "normal",
  });
});
test("detail mode defaults to Normal and persists without changing appearance or language", () => {
  assert.equal(readPreferences('{"detailMode":"geek"}').detailMode, "geek");
  assert.equal(
    readPreferences('{"detailMode":"unexpected"}').detailMode,
    "normal",
  );
  assert.deepEqual(
    readPreferences('{"theme":"dark","language":"en","detailMode":"geek"}'),
    { theme: "dark", language: "en", detailMode: "geek" },
  );
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
test("every legal document has Chinese copy without changing numeric terms", () => {
  const check = (text) => {
    for (const part of text.split(" — ")) {
      assert.ok(zh[part], `Missing Chinese legal text: ${part.slice(0, 90)}`);
    }
  };
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

test("all application translation literals and plate menu labels have Chinese copy", () => {
  const missing = [];
  const visitFile = (file) => {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const check = (text) => {
      if (/[A-Za-z]{2}/.test(text) && !zh[text] && !zh[text.trim()])
        missing.push(`${file}: ${text}`);
    };
    const argument = (node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        check(node.text);
      else if (ts.isConditionalExpression(node)) {
        argument(node.whenTrue);
        argument(node.whenFalse);
      } else if (ts.isParenthesizedExpression(node)) argument(node.expression);
    };
    const walk = (node) => {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "tr" &&
        node.arguments[0]
      )
        argument(node.arguments[0]);
      ts.forEachChild(node, walk);
    };
    walk(source);
  };
  for (const file of fs
    .readdirSync(new URL("../components/", import.meta.url))
    .filter((f) => f.endsWith(".tsx")))
    visitFile(
      new URL("../components/" + file, import.meta.url).pathname.replace(
        /^\/([A-Z]:)/,
        "$1",
      ),
    );
  const plateSource = fs.readFileSync(
    new URL("../lib/plate-types.ts", import.meta.url),
    "utf8",
  );
  for (const [, label] of plateSource.matchAll(/label: "([^"]+)"/g))
    if (!zh[label]) missing.push(`Plate menu: ${label}`);
  assert.deepEqual(missing, []);
});
