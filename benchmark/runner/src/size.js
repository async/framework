import { createGzip } from "node:zlib";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const ASSET_EXTENSIONS = new Set([".css", ".html", ".js", ".json", ".mjs", ".svg", ".wasm"]);
const EXCLUDED_DIRS = new Set(["node_modules", "server"]);

function gzipSize(filePath) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    createReadStream(filePath)
      .pipe(createGzip())
      .on("data", (chunk) => {
        bytes += chunk.length;
      })
      .on("end", () => resolve(bytes))
      .on("error", reject);
  });
}

async function listAssets(root, dir = root) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) files.push(...(await listAssets(root, fullPath)));
      continue;
    }
    if (entry.isFile() && ASSET_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function computeBundleSize(benchmarkRoot, framework) {
  const frameworkRoot = path.join(benchmarkRoot, framework.uri.replace(/\/dist$/, ""));
  const distRoot = path.join(frameworkRoot, "dist");
  const root = await stat(distRoot).then(() => distRoot).catch(() => frameworkRoot);
  const files = await listAssets(root);
  let bytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const fileStat = await stat(file);
    bytes += fileStat.size;
    gzipBytes += await gzipSize(file);
  }
  return {
    root: path.relative(benchmarkRoot, root),
    files: files.length,
    bytes,
    gzipBytes,
  };
}
