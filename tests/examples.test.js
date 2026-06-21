import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Window } from "happy-dom";
import { delay } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = resolve(root, "examples");
const staticExamples = ["counter", "product", "components", "streaming", "server-call", "router", "partials", "cache", "ssr"];
const topLevelExamples = [...staticExamples, "size"];

test("examples index links every top-level example directory", () => {
  const readme = readFileSync(resolve(examplesRoot, "README.md"), "utf8");
  for (const name of topLevelExamples) {
    assert.match(readme, new RegExp(`\\./${escapeRegExp(name)}/README\\.md`), `${name} missing from examples index`);
  }
});

test("top-level public examples have README files", () => {
  for (const name of topLevelExamples) {
    assert.equal(existsSync(resolve(examplesRoot, name, "README.md")), true, `${name} README missing`);
  }
});

test("size scenario examples have README files", () => {
  const sizeRoot = resolve(examplesRoot, "size");
  const scenarios = readdirSync(sizeRoot)
    .filter((name) => statSync(resolve(sizeRoot, name)).isDirectory())
    .sort();
  for (const name of scenarios) {
    assert.equal(existsSync(resolve(sizeRoot, name, "README.md")), true, `${name} README missing`);
  }
});

for (const name of staticExamples) {
  test(`example ${name} has runnable static HTML and JS entrypoints`, async () => {
    const dir = resolve(root, "examples", name);
    const htmlPath = resolve(dir, "index.html");
    const jsPath = resolve(dir, "main.js");

    assert.equal(existsSync(htmlPath), true);
    assert.equal(existsSync(jsPath), true);

    const html = readFileSync(htmlPath, "utf8");
    const js = readFileSync(jsPath, "utf8");
    assert.match(html, /<script type="module" src="\.\/main\.js"><\/script>/);
    assert.match(js, /\.\.\/\.\.\/src\/index\.js/);

    const window = new Window();
    window.document.write(html);
    globalThis.window = window;
    globalThis.document = window.document;

    await import(`${pathToFileURL(jsPath).href}?example=${name}`);
    await delay(name === "product" ? 175 : 0);

    delete globalThis.window;
    delete globalThis.document;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
