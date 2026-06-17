import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import * as bundle from "../framework.js";
import * as minBundle from "../framework.min.js";
import * as source from "../src/index.js";

test("root ESM bundles export the public runtime API", () => {
  assert.deepEqual(Object.keys(bundle).sort(), Object.keys(source).sort());
  assert.deepEqual(Object.keys(minBundle).sort(), Object.keys(source).sort());
  assert.equal(source.Loader, source.AsyncLoader);
  assert.equal(bundle.Loader, bundle.AsyncLoader);
  assert.equal(minBundle.Loader, minBundle.AsyncLoader);
});

test("ESM Async export stays the app hub", () => {
  for (const module of [source, bundle, minBundle]) {
    assert.equal(typeof module.Async.use, "function");
    assert.equal(typeof module.Async.start, "function");
    assert.equal(module.Async.createSignal, undefined);
    assert.equal(module.Async.Async, undefined);
  }
});

test("UMD helper exports do not conflict with app hub fields", () => {
  const conflicts = Object.keys(source)
    .filter((key) => key !== "Async" && Object.hasOwn(source.Async, key));

  assert.deepEqual(conflicts, []);
});

test("root ESM bundles are standalone without relative imports", () => {
  for (const file of ["framework.js", "framework.min.js"]) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

    assert.doesNotMatch(contents, /^\s*import\s/m);
    assert.doesNotMatch(contents, /from\s+["']\.\//);
    assert.match(contents, /^export\s+{/m);
  }
});

test("root UMD bundles expose the public runtime API", () => {
  for (const file of ["framework.umd.js", "framework.umd.min.js"]) {
    const contents = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    const browserContext = {};
    vm.runInNewContext(contents, browserContext, { filename: file });

    assert.equal(browserContext.AsyncFramework, browserContext.Async);
    assert.equal(browserContext.Async.Async, browserContext.Async);
    for (const key of Object.keys(source)) {
      assert.ok(Object.hasOwn(browserContext.Async, key), `${file} missing Async.${key}`);
      if (key !== "Async") {
        assert.equal(typeof browserContext.Async[key], typeof source[key]);
      }
    }
    assert.equal(typeof browserContext.Async.use, "function");
    assert.equal(typeof browserContext.Async.start, "function");
    assert.equal(browserContext.Async.Loader, browserContext.Async.AsyncLoader);

    const cjsContext = {
      module: { exports: {} }
    };
    vm.runInNewContext(contents, cjsContext, { filename: file });

    assert.equal(cjsContext.module.exports.Async, cjsContext.module.exports);
    for (const key of Object.keys(source)) {
      assert.ok(Object.hasOwn(cjsContext.module.exports, key), `${file} missing module.exports.${key}`);
      if (key !== "Async") {
        assert.equal(typeof cjsContext.module.exports[key], typeof source[key]);
      }
    }
    assert.equal(cjsContext.module.exports.Loader, cjsContext.module.exports.AsyncLoader);
  }
});

test("root UMD bundle rejects namespace conflicts before assignment", () => {
  const contents = readFileSync(new URL("../framework.umd.js", import.meta.url), "utf8");
  const conflicting = contents.replace("const api = { ", "const api = { use: asyncSignal, ");

  assert.throws(
    () => vm.runInNewContext(conflicting, {}, { filename: "framework.umd.conflict.js" }),
    /UMD Async namespace export conflict: use/
  );
});

test("root framework.ts facade re-exports the public runtime API", async () => {
  const tsFacade = await import("../framework.ts");

  assert.deepEqual(Object.keys(tsFacade).sort(), Object.keys(source).sort());
});

test("root framework.d.ts declares the public runtime API", () => {
  const declarations = readFileSync(new URL("../framework.d.ts", import.meta.url), "utf8");

  for (const key of Object.keys(source)) {
    assert.match(declarations, new RegExp(`\\b${key}\\b`));
  }
  assert.match(declarations, /declare global/);
  assert.match(declarations, /export declare const Async: AppHub/);
  assert.match(declarations, /const Async: AsyncNamespace/);
  assert.match(declarations, /const AsyncFramework: AsyncNamespace/);
});
