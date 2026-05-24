import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createNetServer } from "node:net";
import ts from "typescript";

const scriptDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptDir, "..");
const exampleRoot = process.cwd();
const startPort = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? "127.0.0.1";

const importRewrites = new Map([
  ["@async/framework-v0/jsx-runtime", "/frameworks/v0/src/jsx-runtime.ts"],
  ["@async/framework-v0/jsx-runtime.ts", "/frameworks/v0/src/jsx-runtime.ts"],
  ["@async/framework-v0", "/frameworks/v0/src/index.ts"],
  ["@async/framework-v1", "/frameworks/v1/src/index.ts"],
  ["@async/framework", "/frameworks/current/index.ts"],
]);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function isInside(parent, child) {
  const relativePath = normalize(child).slice(normalize(parent).length);
  return !relativePath.startsWith(`..${sep}`) && relativePath !== "..";
}

function rewriteImports(source) {
  let rewritten = source;
  for (const [specifier, target] of importRewrites) {
    const escaped = specifier.replaceAll("/", "\\/");
    rewritten = rewritten.replace(
      new RegExp(`(["'])${escaped}\\1`, "g"),
      `$1${target}$1`,
    );
  }
  return rewritten;
}

function transpile(source, path) {
  const jsx = path.endsWith(".tsx") ? ts.JsxEmit.ReactJSX : ts.JsxEmit.Preserve;
  const jsxImportSource = path.includes(`${sep}v1${sep}`)
    ? "@async/framework-v1"
    : "@async/framework-v0";
  return ts.transpileModule(rewriteImports(source), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      jsx,
      jsxImportSource,
    },
    fileName: path,
  }).outputText;
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  if (cleanPath === "/" || cleanPath === "") {
    return join(exampleRoot, "index.html");
  }

  if (cleanPath.startsWith("/frameworks/")) {
    return join(repoRoot, cleanPath);
  }

  if (cleanPath === "/custom-element-signals.js") {
    return join(repoRoot, "packages/custom-element-signals/src/index.ts");
  }

  return join(exampleRoot, cleanPath);
}

async function resolveFilePath(urlPath) {
  const requestPath = resolveRequestPath(urlPath);
  const normalized = resolve(requestPath);
  const allowed = isInside(exampleRoot, normalized) || isInside(repoRoot, normalized);
  if (!allowed) {
    throw Object.assign(new Error("Path is outside the example or repo root"), {
      statusCode: 403,
    });
  }

  const fileStat = await stat(normalized);
  if (fileStat.isDirectory()) {
    return join(normalized, "index.html");
  }
  return normalized;
}

async function sendFile(response, filePath) {
  const extension = extname(filePath);
  if ([".ts", ".tsx", ".js", ".jsx"].includes(extension)) {
    const source = await readFile(filePath, "utf8");
    response.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
    });
    response.end(transpile(source, filePath));
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes.get(extension) ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function findAvailablePort(port) {
  return new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE" && port < 5199) {
        findAvailablePort(port + 1).then(resolvePort, reject);
        return;
      }
      reject(error);
    });
    probe.once("listening", () => {
      probe.close(() => resolvePort(port));
    });
    probe.listen(port, host);
  });
}

const port = await findAvailablePort(startPort);
const server = createServer(async (request, response) => {
  try {
    const filePath = await resolveFilePath(request.url ?? "/");
    await sendFile(response, filePath);
  } catch (error) {
    const statusCode = error.statusCode ?? (error.code === "ENOENT" ? 404 : 500);
    response.writeHead(statusCode, {
      "content-type": "text/plain; charset=utf-8",
    });
    response.end(statusCode === 404 ? "Not found" : String(error.message ?? error));
  }
});

server.listen(port, host, () => {
  console.log(`Serving ${exampleRoot}`);
  console.log(`Local: http://${host}:${port}/`);
});
