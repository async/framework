import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
const distRoot = join(repoRoot, "dist");
const tscBin = join(repoRoot, "node_modules", ".bin", process.platform === "win32" ? "tsc.cmd" : "tsc");

test("runtime JSX profile accepts protocol attributes without global JSX", async () => {
  await assertTypeFixture({
    fixture: "runtime",
    jsxImportSource: "@async/framework/jsx/runtime"
  });
});

test("buildtime JSX profile accepts JSX-native props and rejects protocol props", async () => {
  await assertTypeFixture({
    fixture: "buildtime",
    jsxImportSource: "@async/framework/jsx/buildtime"
  });
});

test("automatic JSX runtime entrypoints are importable from generated dist package", async () => {
  const root = await mkdtemp(join(tmpdir(), "async-framework-jsx-runtime-"));
  try {
    await mkdir(join(root, "node_modules", "@async"), { recursive: true });
    await symlink(distRoot, join(root, "node_modules", "@async", "framework"), "dir");
    await writeFile(join(root, "check.mjs"), `
      const specifiers = [
        "@async/framework/jsx/jsx-runtime",
        "@async/framework/jsx/jsx-dev-runtime",
        "@async/framework/jsx/runtime/jsx-runtime",
        "@async/framework/jsx/runtime/jsx-dev-runtime",
        "@async/framework/jsx/buildtime/jsx-runtime",
        "@async/framework/jsx/buildtime/jsx-dev-runtime"
      ];
      const result = {};
      for (const specifier of specifiers) {
        const mod = await import(specifier);
        result[specifier] = {
          jsx: typeof mod.jsx,
          jsxs: typeof mod.jsxs,
          jsxDEV: typeof mod.jsxDEV,
          Fragment: typeof mod.Fragment
        };
      }
      console.log(JSON.stringify(result));
    `, "utf8");
    const result = JSON.parse((await execFileAsync(process.execPath, ["check.mjs"], { cwd: root })).stdout);
    for (const specifier of Object.keys(result)) {
      assert.deepEqual(result[specifier], {
        jsx: "function",
        jsxs: "function",
        jsxDEV: "function",
        Fragment: "symbol"
      });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function assertTypeFixture({ fixture, jsxImportSource }) {
  const root = await mkdtemp(join(tmpdir(), `async-framework-${fixture}-types-`));
  try {
    await mkdir(join(root, "node_modules", "@async"), { recursive: true });
    await symlink(distRoot, join(root, "node_modules", "@async", "framework"), "dir");
    const sourceFixtureRoot = join(repoRoot, "tests", "fixtures", "jsx-type-profiles", fixture);
    const fixtureRoot = join(root, "src");
    await cp(sourceFixtureRoot, fixtureRoot, { recursive: true });
    await execFileAsync(tscBin, [
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--lib",
      "ES2022,DOM",
      "--jsx",
      "react-jsx",
      "--jsxImportSource",
      jsxImportSource,
      "--skipLibCheck",
      ...fixture === "buildtime"
        ? [join(fixtureRoot, "app.tsx"), join(fixtureRoot, "invalid-protocol-props.tsx")]
        : [join(fixtureRoot, "app.tsx"), join(fixtureRoot, "invalid-jsx-event-props.tsx")]
    ], { cwd: root });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
