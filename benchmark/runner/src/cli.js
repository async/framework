import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { DEFAULT_FRAMEWORKS, selectBenchmarks } from "./benchmarks.js";
import { captureTrace, computeTraceMetrics } from "./trace.js";
import { summarizeRecords } from "./stats.js";
import { computeBundleSize } from "./size.js";
import { ensureServer, fetchJson } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runnerRoot = path.resolve(__dirname, "..");
const benchmarkRoot = path.resolve(runnerRoot, "..");

function parseArgs(argv) {
  const options = {
    mode: "trace",
    host: process.env.HOST ?? "localhost",
    port: Number(process.env.PORT ?? 8080),
    headless: true,
    frameworks: [],
    benchmarks: [],
    iterations: undefined,
    warmups: undefined,
    chromeBinary: undefined,
    resultsDir: path.join(runnerRoot, "results"),
    tracesDir: path.join(runnerRoot, "traces"),
  };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const readValue = () => {
      const value = argv[++index];
      if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    const readValues = () => {
      const values = [];
      while (argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) {
        values.push(...argv[++index].split(",").filter(Boolean));
      }
      if (values.length === 0) throw new Error(`Missing value for ${arg}`);
      return values;
    };
    if (arg === "--mode") options.mode = readValue();
    else if (arg === "--host") options.host = readValue();
    else if (arg === "--port") options.port = Number(readValue());
    else if (arg === "--headless") options.headless = true;
    else if (arg === "--headed") options.headless = false;
    else if (arg === "--framework") options.frameworks.push(...readValues());
    else if (arg === "--benchmark") options.benchmarks.push(...readValues());
    else if (arg === "--iterations") options.iterations = Number(readValue());
    else if (arg === "--warmups") options.warmups = Number(readValue());
    else if (arg === "--chromeBinary") options.chromeBinary = readValue();
    else if (arg === "--results") options.resultsDir = path.resolve(readValue());
    else if (arg === "--traces") options.tracesDir = path.resolve(readValue());
    else if (arg === "--help") options.help = true;
    else throw new Error(`Unknown argument ${arg}`);
  }
  if (!["smoke", "trace"].includes(options.mode)) throw new Error(`Unsupported mode ${options.mode}`);
  options.iterations ??= options.mode === "smoke" ? 1 : 3;
  options.warmups ??= options.mode === "smoke" ? 0 : undefined;
  return options;
}

function printHelp() {
  console.log(`Usage: node src/cli.js [--mode smoke|trace] [--framework react ...] [--benchmark 01_ ...] [--iterations 3]

Defaults:
  mode       trace
  framework  js-only react qwik-v1 qwik-v2 solid-v1 solid-v2
  benchmark  all row-operation benchmarks
  browser    Chromium via Playwright
`);
}

async function firstExistingPath(paths) {
  for (const candidate of paths) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next platform default.
    }
  }
  return null;
}

async function browserLaunchOptions(options) {
  const platformDefaults =
    process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : process.platform === "linux"
        ? ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"]
        : process.platform === "win32"
          ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
          : [];
  const executablePath = options.chromeBinary ?? (await firstExistingPath(platformDefaults));
  return {
    headless: options.headless,
    args: ["--js-flags=--expose-gc", "--enable-benchmarking", "--window-size=1000,800"],
    ...(executablePath ? { executablePath } : {}),
  };
}

function frameworkMatches(framework, selected) {
  if (selected.length === 0) return DEFAULT_FRAMEWORKS.includes(framework.directory);
  return selected.includes(framework.directory);
}

async function loadFrameworks(host, port, selectedFrameworks) {
  const rows = await fetchJson(`http://${host}:${port}/ls`);
  return rows
    .filter((row) => frameworkMatches(row, selectedFrameworks))
    .map((row) => ({
      name: row.directory,
      type: row.type,
      fullName: row.frameworkVersionString,
      uri: `apps/${row.directory}${row.customURL ?? ""}`,
      customURL: row.customURL,
      versions: row.versions ?? {},
      language: row.language ?? "",
      startLogicEventName: row.startLogicEventName ?? "click",
    }));
}

async function forceGC(page) {
  await page.evaluate(() => {
    globalThis.gc?.({ type: "major", execution: "sync", flavor: "last-resort" });
  });
}

async function measureMemoryMB(page, client) {
  try {
    const result = await page.evaluate(async () => {
      if (!performance.measureUserAgentSpecificMemory) return null;
      return (await performance.measureUserAgentSpecificMemory()).bytes / 1024 / 1024;
    });
    if (typeof result === "number" && Number.isFinite(result)) return result;
  } catch {
    // Fall back to CDP below.
  }
  await client.send("Performance.enable");
  const metrics = await client.send("Performance.getMetrics");
  const heapMetric = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize");
  return heapMetric ? heapMetric.value / 1024 / 1024 : null;
}

function tracePathFor(options, framework, benchmark, iteration) {
  return path.join(options.tracesDir, `${framework.fullName}_${benchmark.id}_${iteration}.json`);
}

async function runOneIteration({ browser, framework, benchmark, options, iteration }) {
  const page = await browser.newPage();
  const client = await page.context().newCDPSession(page);
  const url = `http://${options.host}:${options.port}/${framework.uri}/index.html`;
  try {
    await page.goto(url, { waitUntil: "networkidle" });
    const warmups = options.warmups ?? benchmark.defaultWarmups;
    await benchmark.init(page, warmups);
    await forceGC(page);

    const startedAt = performance.now();
    let tracePath = null;
    if (options.mode === "trace") {
      tracePath = tracePathFor(options, framework, benchmark, iteration);
      await captureTrace(client, tracePath, () => benchmark.run(page, warmups));
    } else {
      await benchmark.run(page, warmups);
    }
    const roughDuration = performance.now() - startedAt;
    await forceGC(page);
    const memoryMB = await measureMemoryMB(page, client);
    const traceMetrics = tracePath ? await computeTraceMetrics(tracePath, framework.startLogicEventName) : null;

    return {
      iteration,
      roughDuration,
      memoryMB,
      tracePath: tracePath ? path.relative(runnerRoot, tracePath) : null,
      total: traceMetrics?.total ?? roughDuration,
      script: traceMetrics?.script ?? null,
      paint: traceMetrics?.paint ?? null,
      traceWindow: traceMetrics?.traceWindow ?? null,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  await mkdir(options.resultsDir, { recursive: true });
  await mkdir(options.tracesDir, { recursive: true });

  const server = await ensureServer({ benchmarkRoot, host: options.host, port: options.port });
  try {
    const frameworks = await loadFrameworks(options.host, options.port, options.frameworks);
    const benchmarks = selectBenchmarks(options.benchmarks);
    if (frameworks.length === 0) throw new Error("No matching frameworks found from /ls");
    if (benchmarks.length === 0) throw new Error("No matching benchmarks selected");

    console.log("Modern runner frameworks:", frameworks.map((framework) => framework.fullName).join(", "));
    console.log("Modern runner benchmarks:", benchmarks.map((benchmark) => benchmark.id).join(", "));

    const browser = await chromium.launch(await browserLaunchOptions(options));
    const results = [];
    try {
      for (const framework of frameworks) {
        const size = await computeBundleSize(benchmarkRoot, framework);
        for (const benchmark of benchmarks) {
          const iterations = [];
          for (let iteration = 0; iteration < options.iterations; iteration++) {
            console.log(`[modern] ${framework.fullName} ${benchmark.id} iteration ${iteration + 1}/${options.iterations}`);
            iterations.push(await runOneIteration({ browser, framework, benchmark, options, iteration }));
          }
          results.push({
            framework: framework.name,
            frameworkVersion: framework.fullName,
            benchmark: benchmark.id,
            label: benchmark.label,
            mode: options.mode,
            browser: "chromium",
            iterations,
            summary: {
              total: summarizeRecords(iterations, "total"),
              script: summarizeRecords(iterations, "script"),
              paint: summarizeRecords(iterations, "paint"),
              roughDuration: summarizeRecords(iterations, "roughDuration"),
              memoryMB: summarizeRecords(iterations, "memoryMB"),
            },
            size,
          });
        }
      }
    } finally {
      await browser.close().catch(() => {});
    }

    const output = {
      generatedAt: new Date().toISOString(),
      mode: options.mode,
      browser: "chromium",
      host: options.host,
      port: options.port,
      frameworkCount: frameworks.length,
      benchmarkCount: benchmarks.length,
      results,
    };
    const outputPath = path.join(options.resultsDir, "latest.json");
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`Modern benchmark results written to ${path.relative(benchmarkRoot, outputPath)}`);
  } finally {
    await server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
