import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import * as framework from "../src/index.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("runtime does not expose VDOM-style node, patch, or hydration entrypoints", () => {
  for (const name of ["createVNode", "h", "patch", "diff", "hydrate", "rerender"]) {
    assert.equal(Object.hasOwn(framework, name), false);
  }
});

test("source stays centered on loader bindings instead of VDOM machinery", () => {
  const source = readdirSync(resolve(root, "src"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(resolve(root, "src", file), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /createVNode|patchVNode|hydrate|hydration|rerender/i);
});

test("inline command parsing does not use eval or function constructors", () => {
  const source = readdirSync(resolve(root, "src"))
    .filter((file) => file.endsWith(".js"))
    .map((file) => readFileSync(resolve(root, "src", file), "utf8"))
    .join("\n");

  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
});
