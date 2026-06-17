import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { Window } from "happy-dom";
import { delay } from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examples = ["counter", "product", "components", "streaming"];

for (const name of examples) {
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
