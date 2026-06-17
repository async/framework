import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { lintRegistry } from "../scripts/registry-lint.js";

test("registry lint detects same type and id with different content", async () => {
  const root = await fixtureRoot();
  try {
    await writeFixture(root, "src/a.js", `
      Async.use({
        signal: {
          count: createSignal(0)
        }
      });
    `);
    await writeFixture(root, "src/b.js", `
      Async.use("signal", {
        count: createSignal(1)
      });
    `);

    const manifest = await lintRegistry({ root, includeDirs: ["src"] });

    assert.equal(manifest.conflicts.length, 1);
    assert.equal(manifest.conflicts[0].type, "signal");
    assert.equal(manifest.conflicts[0].id, "count");
    assert.equal(manifest.conflicts[0].locations.length, 2);
    assert.equal(JSON.parse(await readFile(join(root, ".async/registry-manifest.json"), "utf8")).conflicts.length, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registry lint allows duplicate ids when content is the same and reuses cache", async () => {
  const root = await fixtureRoot();
  try {
    const source = `
      Async.use({
        handler: {
          save() {
            return "ok";
          }
        }
      });
    `;
    await writeFixture(root, "src/a.js", source);
    await writeFixture(root, "src/b.js", source);

    const first = await lintRegistry({ root, includeDirs: ["src"] });
    const second = await lintRegistry({ root, includeDirs: ["src"] });

    assert.equal(first.conflicts.length, 0);
    assert.equal(first.duplicates.length, 1);
    assert.equal(first.duplicates[0].type, "handler");
    assert.equal(first.duplicates[0].id, "save");
    assert.equal(second.cache.reused, 2);
    assert.equal(second.cache.parsed, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registry lint excludes generated root bundles", async () => {
  const root = await fixtureRoot();
  try {
    await writeFixture(root, "src/app.js", `
      Async.use({
        handler: {
          save() {
            return "src";
          }
        }
      });
    `);
    await writeFixture(root, "framework.umd.js", `
      Async.use({
        handler: {
          save() {
            return "bundle";
          }
        }
      });
    `);

    const manifest = await lintRegistry({ root, includeDirs: ["."] });

    assert.equal(manifest.conflicts.length, 0);
    assert.deepEqual(manifest.entries.map((entry) => entry.file), ["src/app.js"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("registry lint cache keeps full parse results across type filters", async () => {
  const root = await fixtureRoot();
  try {
    await writeFixture(root, "src/app.js", `
      Async.use({
        signal: {
          count: createSignal(0)
        },
        handler: {
          increment() {
            return "ok";
          }
        }
      });
    `);

    const signalsOnly = await lintRegistry({ root, includeDirs: ["src"], types: ["signal"] });
    const full = await lintRegistry({ root, includeDirs: ["src"] });

    assert.equal(signalsOnly.entries.length, 1);
    assert.equal(full.cache.reused, 1);
    assert.deepEqual(full.entries.map((entry) => `${entry.type}:${entry.id}`).sort(), [
      "handler:increment",
      "signal:count"
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function fixtureRoot() {
  return mkdtemp(join(tmpdir(), "async-framework-registry-lint-"));
}

async function writeFixture(root, file, contents) {
  const path = join(root, file);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, `${contents.trim()}\n`, "utf8");
}
