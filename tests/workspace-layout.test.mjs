import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("pnpm workspace layout", () => {
  it("defines versioned framework packages with real source directories", async () => {
    const v0 = await readJson("frameworks/v0/package.json");
    const v1 = await readJson("frameworks/v1/package.json");
    const current = await readJson("frameworks/current/package.json");

    assert.equal(v0.name, "@async/framework-v0");
    assert.equal(v1.name, "@async/framework-v1");
    assert.equal(current.name, "@async/framework");
    assert.equal(current.dependencies["@async/framework-v1"], "workspace:*");

    assert.equal(v0.exports["."], "./src/index.ts");
    assert.equal(v1.exports["."], "./src/index.ts");
    assert.equal(current.exports["."], "./index.ts");
  });

  it("keeps examples version-first and pinned to explicit framework versions", async () => {
    const v0Example = await readJson("examples/v0/hello-world/package.json");
    const v1Example = await readJson("examples/v1/basic-local/package.json");

    assert.equal(v0Example.name, "@async/example-v0-hello-world");
    assert.equal(v0Example.dependencies["@async/framework-v0"], "workspace:*");
    assert.ok(!("@async/framework" in v0Example.dependencies));

    assert.equal(v1Example.name, "@async/example-v1-basic-local");
    assert.equal(v1Example.dependencies["@async/framework-v1"], "workspace:*");
    assert.ok(!("@async/framework" in v1Example.dependencies));
  });
});
