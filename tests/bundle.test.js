import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as bundle from "../framework.js";
import * as source from "../src/index.js";

test("root framework.js bundle exports the public runtime API", () => {
  assert.deepEqual(Object.keys(bundle).sort(), Object.keys(source).sort());
});

test("root framework.js bundle is standalone ESM without relative imports", () => {
  const contents = readFileSync(new URL("../framework.js", import.meta.url), "utf8");

  assert.doesNotMatch(contents, /^\s*import\s/m);
  assert.doesNotMatch(contents, /from\s+["']\.\//);
  assert.match(contents, /^export\s+{/m);
});
