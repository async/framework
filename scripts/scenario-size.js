#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplesRoot = join(root, "examples", "size");
const baselinePath = join(root, "tests", "fixtures", "scenario-size-baseline.json");

if (isCli()) {
  try {
    const receipt = await createScenarioSizeReceipt({ root, examplesRoot });
    if (process.argv.includes("--check")) {
      const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
      checkScenarioSizeReceipt(receipt, baseline);
    }
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify(receipt, null, 2));
    } else {
      printScenarioSizeReceipt(receipt);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

export async function createScenarioSizeReceipt(options = {}) {
  const packageRoot = options.root ?? root;
  const scenarioRoot = options.examplesRoot ?? examplesRoot;
  const definitions = await readScenarioDefinitions(scenarioRoot);
  return {
    version: 1,
    package: "@async/framework",
    scenarios: await Promise.all(definitions.map((definition) => measureScenario(definition, packageRoot)))
  };
}

export async function readScenarioDefinitions(scenarioRoot = examplesRoot) {
  const entries = await readdir(scenarioRoot, { withFileTypes: true });
  const definitions = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const dir = join(scenarioRoot, entry.name);
    const configPath = join(dir, "scenario.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    const scripts = config.scripts ?? [config.entry];
    definitions.push({
      id: config.id ?? entry.name,
      entry: normalizeRelative(config.entry ?? "main.js"),
      dir,
      scripts: scripts.map(normalizeRelative),
      budget: config.budget ?? { mode: "baseline" }
    });
  }
  return definitions;
}

export function checkScenarioSizeReceipt(receipt, baseline) {
  const baselineById = new Map((baseline.scenarios ?? []).map((scenario) => [scenario.id, scenario]));
  for (const scenario of receipt.scenarios) {
    const expected = baselineById.get(scenario.id);
    if (!expected) {
      throw new Error(`Scenario ${scenario.id} is missing from scenario-size baseline.`);
    }
    if (scenario.scripts.length === 0) {
      throw new Error(`Scenario ${scenario.id} emitted no browser scripts.`);
    }
    for (const script of scenario.scripts) {
      if (script.rawBytes <= 0 || script.gzipBytes <= 0) {
        throw new Error(`Scenario ${scenario.id} has an empty script: ${script.file}`);
      }
    }
    const maxGzip = expected.budget?.maxGzipBytes ?? expected.closure.gzipBytes;
    if (scenario.closure.gzipBytes > maxGzip) {
      throw new Error(
        `Scenario ${scenario.id} gzip ${scenario.closure.gzipBytes} B exceeds baseline budget ${maxGzip} B.`
      );
    }
  }
}

export function printScenarioSizeReceipt(receipt) {
  console.log("Scenario size receipt");
  for (const scenario of receipt.scenarios) {
    console.log(
      `- ${scenario.id}: ${formatBytes(scenario.closure.rawBytes)} raw / ${formatBytes(scenario.closure.gzipBytes)} gzip`
    );
    for (const script of scenario.scripts) {
      console.log(`  ${script.file}: ${formatBytes(script.rawBytes)} raw / ${formatBytes(script.gzipBytes)} gzip`);
    }
  }
}

async function measureScenario(definition, packageRoot) {
  const scripts = [];
  const closureParts = [];
  for (const relativeScript of definition.scripts) {
    const absoluteScript = resolve(definition.dir, relativeScript);
    if (!absoluteScript.startsWith(packageRoot)) {
      throw new Error(`Scenario ${definition.id} script escapes the package root: ${relativeScript}`);
    }
    const buffer = await readFile(absoluteScript);
    scripts.push({
      file: normalizeRelativePath(packageRoot, absoluteScript),
      rawBytes: buffer.byteLength,
      gzipBytes: gzipSync(buffer, { level: 9 }).byteLength
    });
    closureParts.push(buffer);
  }
  if (scripts.length === 0) {
    throw new Error(`Scenario ${definition.id} emitted no browser scripts.`);
  }
  const closure = Buffer.concat(closureParts);
  return {
    id: definition.id,
    entry: normalizeRelativePath(packageRoot, resolve(definition.dir, definition.entry)),
    scripts,
    closure: {
      rawBytes: scripts.reduce((sum, script) => sum + script.rawBytes, 0),
      gzipBytes: gzipSync(closure, { level: 9 }).byteLength
    },
    budget: definition.budget
  };
}

function formatBytes(value) {
  return `${new Intl.NumberFormat("en-US").format(value)} B`;
}

function normalizeRelative(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("Scenario script path must be a non-empty string.");
  }
  return value.replaceAll("\\", "/");
}

function normalizeRelativePath(base, file) {
  return file.slice(base.length + 1).replaceAll("\\", "/");
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
}
