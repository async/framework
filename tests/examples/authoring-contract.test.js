import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const examplesRoot = resolve(repoRoot, "examples");
const sourceExtensions = new Set([".html", ".js", ".jsx"]);
const prohibited = {
  globalSelectors: /\bdocument\.(?:querySelector|querySelectorAll|getElementById|getElementsByClassName|getElementsByTagName)\s*\(/g,
  documentListeners: /\bdocument\.addEventListener\s*\(/g,
  innerHtmlAssignments: /\.innerHTML\s*=/g
};
const allowedCounts = {
  "ssr/main.js": {
    globalSelectors: 2,
    documentListeners: 0,
    innerHtmlAssignments: 1
  },
  "size/stream-backpatch/main.js": {
    globalSelectors: 1,
    documentListeners: 0,
    innerHtmlAssignments: 0
  },
  "vite-jsx-streaming/src/main.js": {
    globalSelectors: 1,
    documentListeners: 0,
    innerHtmlAssignments: 0
  }
};
const exceptionReadmes = {
  "ssr/main.js": "ssr/README.md",
  "size/stream-backpatch/main.js": "size/stream-backpatch/README.md",
  "vite-jsx-streaming/src/main.js": "vite-jsx-streaming/README.md"
};

test("public examples follow the app authoring contract", () => {
  const visited = new Set();

  for (const file of exampleSources(examplesRoot)) {
    const source = readFileSync(file, "utf8");
    const fileName = relative(examplesRoot, file).split(sep).join("/");
    const actual = Object.fromEntries(
      Object.entries(prohibited).map(([rule, pattern]) => [
        rule,
        source.match(pattern)?.length ?? 0
      ])
    );
    const expected = allowedCounts[fileName] ?? {
      globalSelectors: 0,
      documentListeners: 0,
      innerHtmlAssignments: 0
    };

    assert.deepEqual(actual, expected, `${fileName} violates the app authoring contract`);
    if (allowedCounts[fileName]) {
      visited.add(fileName);
    }
  }

  assert.deepEqual([...visited].sort(), Object.keys(allowedCounts).sort());
});

test("imperative DOM example exceptions explain their adapter boundary", () => {
  for (const [sourceFile, readmeFile] of Object.entries(exceptionReadmes)) {
    const readme = readFileSync(resolve(examplesRoot, readmeFile), "utf8");
    assert.match(
      readme,
      /^## Imperative DOM exception$/m,
      `${sourceFile} must explain its imperative DOM exception in ${readmeFile}`
    );
  }
});

function exampleSources(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...exampleSources(path));
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}
