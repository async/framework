import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { ensureServer, fetchJson } from "./server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runnerRoot = path.resolve(__dirname, "..");
const benchmarkRoot = path.resolve(runnerRoot, "..");
const DEFAULT_APPS = ["js-only", "react", "qwik-v1", "qwik-v2", "solid-v1", "solid-v2"];
const requiredControls = ["#run", "#runlots", "#add", "#update", "#clear", "#swaprows"];

function parseArgs(argv) {
  const options = {
    host: process.env.HOST ?? "localhost",
    port: Number(process.env.PORT ?? 8080),
    headless: true,
    frameworks: [],
    chromeBinary: undefined,
    resultsDir: path.join(runnerRoot, "results"),
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

    if (arg === "--host") options.host = readValue();
    else if (arg === "--port") options.port = Number(readValue());
    else if (arg === "--headless") options.headless = true;
    else if (arg === "--headed") options.headless = false;
    else if (arg === "--framework") options.frameworks.push(...readValues());
    else if (arg === "--chromeBinary") options.chromeBinary = readValue();
    else if (arg === "--results") options.resultsDir = path.resolve(readValue());
    else if (arg === "--help") options.help = true;
    else throw new Error(`Unknown argument ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node src/apps.js [--framework react ...] [--headed]

Build output must already exist. This check starts or reuses the benchmark server,
loads each selected app, verifies the shared benchmark UI is present, and does
not click row-operation buttons or collect benchmark timings.
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
    args: ["--window-size=1000,800"],
    ...(executablePath ? { executablePath } : {}),
  };
}

function frameworkMatches(framework, selected) {
  if (selected.length === 0) return DEFAULT_APPS.includes(framework.directory);
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
      language: row.language ?? "",
    }));
}

async function checkApp(browser, framework, options) {
  const page = await browser.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? ""}`.trim());
  });

  const url = `http://${options.host}:${options.port}/${framework.uri}/index.html`;
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    if (!response?.ok()) throw new Error(`Expected ${url} to load with 2xx status, got ${response?.status() ?? "no response"}`);

    for (const selector of requiredControls) {
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 10_000 });
    }
    await page.locator("table.test-data tbody").first().waitFor({ state: "attached", timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

    if (pageErrors.length > 0) throw new Error(`Page errors: ${pageErrors.join("; ")}`);
    if (failedRequests.length > 0) throw new Error(`Failed requests: ${failedRequests.join("; ")}`);

    const heading = await page.locator("h1").first().innerText().catch(() => "");
    return {
      framework: framework.name,
      frameworkVersion: framework.fullName,
      url,
      customURL: framework.customURL ?? null,
      heading,
      status: "ok",
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
  const server = await ensureServer({ benchmarkRoot, host: options.host, port: options.port });
  try {
    const frameworks = await loadFrameworks(options.host, options.port, options.frameworks);
    if (frameworks.length === 0) throw new Error("No matching frameworks found from /ls");

    console.log("App health frameworks:", frameworks.map((framework) => framework.fullName).join(", "));
    const browser = await chromium.launch(await browserLaunchOptions(options));
    const results = [];
    try {
      for (const framework of frameworks) {
        console.log(`[apps] ${framework.fullName}`);
        results.push(await checkApp(browser, framework, options));
      }
    } finally {
      await browser.close().catch(() => {});
    }

    const output = {
      generatedAt: new Date().toISOString(),
      browser: "chromium",
      host: options.host,
      port: options.port,
      frameworkCount: frameworks.length,
      results,
    };
    const outputPath = path.join(options.resultsDir, "apps-latest.json");
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    console.log(`App health results written to ${path.relative(benchmarkRoot, outputPath)}`);
  } finally {
    await server.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
