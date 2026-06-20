import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const benchmarkRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(benchmarkRoot, "..");
const appsDirectory = process.argv[2] ? path.resolve(benchmarkRoot, process.argv[2]) : path.join(benchmarkRoot, "apps");
const cssDirectory = path.join(benchmarkRoot, "css");
const frameworkSourceDirectory = path.join(repositoryRoot, "src");
const publicDirectory = path.join(__dirname, "public");
const latestResultsPath = path.join(benchmarkRoot, "runner", "results", "latest.json");
const port = Number(process.env.PORT ?? 8080);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".wasm", "application/wasm"],
]);

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    console.error(error);
    sendText(response, 500, "Internal server error");
  }
});

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

async function route(request, response) {
  if (!request.url) {
    sendText(response, 400, "Missing URL");
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? `localhost:${port}`}`);
  if (request.method === "GET" && url.pathname === "/ls") {
    const startedAt = performance.now();
    const frameworks = await loadFrameworkVersions();
    console.log(`/ls duration: ${performance.now() - startedAt}ms`);
    sendJson(response, 200, frameworks);
    return;
  }

  if (request.method === "GET" && url.pathname === "/results.json") {
    await sendFile(response, latestResultsPath, { cache: false });
    return;
  }

  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    sendHtml(response, shellHtml("apps"));
    return;
  }

  if (request.method === "GET" && (url.pathname === "/results" || url.pathname === "/results.html")) {
    sendHtml(response, shellHtml("results"));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/apps/")) {
    await sendStatic(response, appsDirectory, url.pathname.slice("/apps/".length), { appHeaders: url.pathname.endsWith("index.html") });
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/css/")) {
    await sendStatic(response, cssDirectory, url.pathname.slice("/css/".length));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/framework/")) {
    await sendStatic(response, frameworkSourceDirectory, url.pathname.slice("/framework/".length));
    return;
  }

  if (request.method === "GET" && url.pathname.startsWith("/ui/")) {
    await sendStatic(response, publicDirectory, url.pathname.slice("/ui/".length), { cache: false });
    return;
  }

  sendText(response, 404, "Not found");
}

function shellHtml(view) {
  return `<!doctype html>
<html>
  <head>
    <title>Async Framework Benchmark Harness</title>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="/css/tailwind.css">
    <meta name="viewport" content="width=device-width, initial-scale=1">
  </head>
  <body>
    <main id="benchmark-ui" async:container data-view="${view}" class="min-h-screen bg-slate-50 py-8">
      <section class="mx-auto max-w-7xl px-6">
        <div class="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 class="text-4xl font-semibold tracking-normal text-slate-900">Async Framework Benchmark Harness</h1>
              <p id="status" class="mt-2 text-sm text-slate-600">Loading</p>
            </div>
            <div class="flex gap-3">
              <button type="button" id="show-apps" on:click="view.apps" class="rounded border border-slate-200 bg-white px-4 py-2.5 text-sky-700 transition hover:text-sky-900">Apps</button>
              <button type="button" id="show-results" on:click="view.results" class="rounded border border-slate-200 bg-white px-4 py-2.5 text-sky-700 transition hover:text-sky-900">Results</button>
            </div>
          </div>
        </div>
        <section id="apps-panel" class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div id="apps-grid" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"></div>
        </section>
        <section id="results-panel" class="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" hidden>
          <div class="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div id="results-meta" class="text-sm text-slate-600"></div>
            <div class="flex flex-col gap-3 sm:flex-row">
              <span class="inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"><span class="inline-block h-3 w-3 rounded bg-emerald-500"></span>Best</span>
              <span class="inline-flex items-center gap-2 rounded border border-lime-200 bg-lime-50 px-3 py-2 text-sm text-lime-900"><span class="inline-block h-3 w-3 rounded bg-lime-500"></span>Close</span>
              <span class="inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"><span class="inline-block h-3 w-3 rounded bg-amber-500"></span>Behind</span>
              <span class="inline-flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900"><span class="inline-block h-3 w-3 rounded bg-rose-500"></span>Slowest</span>
            </div>
          </div>
          <section class="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div class="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 class="text-lg font-semibold tracking-normal text-slate-900">Frameworks</h2>
                <p id="framework-filter-summary" class="mt-2 text-sm text-slate-600"></p>
              </div>
              <div class="flex gap-3">
                <button type="button" on:click="filters.all" class="rounded border border-slate-200 bg-white px-4 py-2.5 text-sky-700 transition hover:text-sky-900">All</button>
                <button type="button" on:click="filters.asyncOnly" class="rounded border border-slate-200 bg-white px-4 py-2.5 text-sky-700 transition hover:text-sky-900">Only Async</button>
              </div>
            </div>
            <div id="framework-toggles" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"></div>
          </section>
          <section class="mb-6">
            <h2 class="mb-3 text-2xl font-semibold tracking-normal text-slate-900">Overall</h2>
            <div id="results-overall" class="overflow-x-auto"></div>
          </section>
          <section>
            <h2 class="mb-3 text-2xl font-semibold tracking-normal text-slate-900">Benchmarks</h2>
            <div id="results-groups" class="flex flex-col gap-5"></div>
          </section>
        </section>
      </section>
    </main>
    <script type="module" src="/ui/app.js"></script>
  </body>
</html>`;
}

async function loadFrameworkVersions() {
  const directories = await readdir(appsDirectory, { withFileTypes: true });
  const frameworks = [];
  for (const directory of directories) {
    if (!directory.isDirectory()) continue;
    if (!(await isFrameworkDir(directory.name))) continue;
    frameworks.push(await loadFrameworkInfo(directory.name));
  }
  return frameworks.sort((a, b) => a.frameworkVersionString.localeCompare(b.frameworkVersionString));
}

async function isFrameworkDir(directory) {
  try {
    await stat(path.join(appsDirectory, directory, "package.json"));
    await stat(path.join(appsDirectory, directory, "package-lock.json"));
    return true;
  } catch {
    return false;
  }
}

async function loadFrameworkInfo(directory) {
  const packageJson = JSON.parse(await readFile(path.join(appsDirectory, directory, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(appsDirectory, directory, "package-lock.json"), "utf8"));
  const benchmarkData = packageJson["async-framework-benchmark"];
  if (!benchmarkData) {
    return { type: "app", directory, error: "package.json must contain an async-framework-benchmark property" };
  }

  const result = {
    type: "app",
    directory,
    uri: `apps/${directory}${benchmarkData.customURL ?? ""}`,
    issues: benchmarkData.issues,
    customURL: benchmarkData.customURL,
    frameworkHomeURL: benchmarkData.frameworkHomeURL,
    language: benchmarkData.language,
    useShadowRoot: benchmarkData.useShadowRoot,
    useRowShadowRoot: benchmarkData.useRowShadowRoot,
    shadowRootName: benchmarkData.useShadowRoot ? benchmarkData.shadowRootName ?? "main-element" : undefined,
    buttonsInShadowRoot: benchmarkData.useShadowRoot ? benchmarkData.buttonsInShadowRoot ?? true : undefined,
    startLogicEventName: benchmarkData.startLogicEventName ?? "click",
    sizeRoot: benchmarkData.sizeRoot,
  };

  if (benchmarkData.frameworkVersionFromPackage) {
    const packageNames = benchmarkData.frameworkVersionFromPackage.split(":");
    const versions = {};
    for (const packageName of packageNames) {
      versions[packageName] =
        packageLock.dependencies?.[packageName]?.version ||
        packageLock.packages?.[`node_modules/${packageName}`]?.version ||
        "ERROR: Not found in package-lock";
    }
    const version = packageNames.map((name) => versions[name]).join(" + ");
    return {
      ...result,
      versions,
      frameworkVersionString: buildFrameworkVersionString(directory, version),
    };
  }

  if (benchmarkData.frameworkVersionFromRootPackage) {
    const rootPackageJson = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
    if (rootPackageJson.name !== benchmarkData.frameworkVersionFromRootPackage) {
      return {
        ...result,
        error: `Root package name ${rootPackageJson.name} does not match ${benchmarkData.frameworkVersionFromRootPackage}`,
      };
    }
    return {
      ...result,
      version: rootPackageJson.version,
      frameworkVersionString: buildFrameworkVersionString(directory, rootPackageJson.version),
    };
  }

  if (typeof benchmarkData.frameworkVersion === "string") {
    return {
      ...result,
      version: benchmarkData.frameworkVersion,
      frameworkVersionString: buildFrameworkVersionString(directory, benchmarkData.frameworkVersion),
    };
  }

  return {
    ...result,
    error: "package.json must contain frameworkVersionFromPackage, frameworkVersionFromRootPackage, or frameworkVersion",
  };
}

function buildFrameworkVersionString(directory, version) {
  return `${directory}${version ? `-v${version}` : ""}`;
}

async function sendStatic(response, root, relativePath, options = {}) {
  const decoded = decodeURIComponent(relativePath);
  const fullPath = path.resolve(root, decoded);
  if (!fullPath.startsWith(`${path.resolve(root)}${path.sep}`) && fullPath !== path.resolve(root)) {
    sendText(response, 403, "Forbidden");
    return;
  }
  await sendFile(response, fullPath, options);
}

async function sendFile(response, filePath, options = {}) {
  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    sendText(response, 404, "Not found");
    return;
  }
  if (!fileStat.isFile()) {
    sendText(response, 404, "Not found");
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "content-type": contentTypes.get(extension) ?? "application/octet-stream",
    "content-length": fileStat.size,
    ...(options.cache === false ? { "cache-control": "no-store" } : {}),
    ...(options.appHeaders
      ? {
          "cross-origin-embedder-policy": "require-corp",
          "cross-origin-opener-policy": "same-origin",
        }
      : {}),
  });
  createReadStream(filePath).pipe(response);
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "content-length": Buffer.byteLength(html),
  });
  response.end(html);
}

function sendJson(response, statusCode, value) {
  const json = `${JSON.stringify(value, null, 2)}\n`;
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  response.end(json);
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "content-length": Buffer.byteLength(text),
  });
  response.end(text);
}
