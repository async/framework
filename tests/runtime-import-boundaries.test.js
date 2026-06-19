import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import manifest from "../package.json" with { type: "json" };
import publishManifest from "../dist/package.json" with { type: "json" };

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bannedImports = [
  "src/app.js",
  "src/loader.js",
  "src/router.js",
  "src/server.js",
  "src/server-entry.js",
  "src/server-registry.js",
  "src/partials.js",
  "src/cache.js",
  "src/component.js",
  "src/boundary-receiver.js",
  "src/handlers.js",
  "src/lazy-registry.js"
];

test("runtime subpaths are declared on source and publish manifests", () => {
  for (const packageManifest of [manifest, publishManifest]) {
    assert.deepEqual(packageManifest.exports["./runtime"], {
      types: "./runtime.d.ts",
      import: "./runtime.js",
      default: "./runtime.js"
    });
    assert.deepEqual(packageManifest.exports["./runtime/signals"], {
      types: "./runtime/signals.d.ts",
      import: "./runtime/signals.js",
      default: "./runtime/signals.js"
    });
    assert.deepEqual(packageManifest.exports["./runtime/events"], {
      types: "./runtime/events.d.ts",
      import: "./runtime/events.js",
      default: "./runtime/events.js"
    });
  }
});

test("runtime source entrypoints expose feature-specific starters", async () => {
  const runtime = await import("../src/runtime.js");
  const signals = await import("../src/runtime/signals.js");
  const events = await import("../src/runtime/events.js");

  assert.deepEqual(Object.keys(runtime).sort(), ["start"]);
  assert.deepEqual(Object.keys(signals).sort(), ["startSignals"]);
  assert.deepEqual(Object.keys(events).sort(), ["startEvents"]);
});

test("runtime dist entrypoints expose feature-specific starters", async () => {
  const runtime = await import("../dist/runtime.js");
  const signals = await import("../dist/runtime/signals.js");
  const events = await import("../dist/runtime/events.js");

  assert.deepEqual(Object.keys(runtime).sort(), ["start"]);
  assert.deepEqual(Object.keys(signals).sort(), ["startSignals"]);
  assert.deepEqual(Object.keys(events).sort(), ["startEvents"]);
});

test("runtime slices do not import no-build-only systems", () => {
  for (const entry of [
    "src/runtime.js",
    "src/runtime/signals.js",
    "src/runtime/events.js"
  ]) {
    const graph = collectRelativeImportGraph(entry);
    for (const banned of bannedImports) {
      assert.equal(graph.has(banned), false, `${entry} must not import ${banned}`);
    }
  }
});

test("runtime declarations match runtime value exports", () => {
  assertDeclarationExports("dist/runtime.d.ts", ["start"]);
  assertDeclarationExports("dist/runtime/signals.d.ts", ["startSignals"]);
  assertDeclarationExports("dist/runtime/events.d.ts", ["startEvents"]);
});

function collectRelativeImportGraph(entry, seen = new Set()) {
  const normalized = normalize(entry);
  if (seen.has(normalized)) {
    return seen;
  }
  seen.add(normalized);
  const source = readFileSync(resolve(root, normalized), "utf8");
  for (const specifier of importSpecifiers(source)) {
    if (!specifier.startsWith(".")) {
      continue;
    }
    collectRelativeImportGraph(resolveImport(normalized, specifier), seen);
  }
  return seen;
}

function importSpecifiers(source) {
  return [
    ...source.matchAll(/import\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["'];/g),
    ...source.matchAll(/export\s+[\s\S]*?\s+from\s+["']([^"']+)["'];/g)
  ].map((match) => match[1]);
}

function resolveImport(from, specifier) {
  const base = dirname(resolve(root, from));
  return normalize(resolve(base, specifier));
}

function normalize(file) {
  return file.startsWith(root) ? file.slice(root.length + 1).replaceAll("\\", "/") : file.replaceAll("\\", "/");
}

function assertDeclarationExports(file, names) {
  const source = readFileSync(resolve(root, file), "utf8");
  for (const name of names) {
    assert.match(source, new RegExp(`export declare function ${name}\\b`));
  }
}
