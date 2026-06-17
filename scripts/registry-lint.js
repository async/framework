#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const cacheVersion = 2;
const manifestVersion = 1;
const defaultIncludeDirs = ["src", "examples"];
const defaultTypes = new Set(["signal", "handler", "server", "partial", "route", "component"]);
const registryFactoryTypes = new Map([
  ["createSignalRegistry", "signal"],
  ["createHandlerRegistry", "handler"],
  ["createServerRegistry", "server"],
  ["createPartialRegistry", "partial"],
  ["createRouteRegistry", "route"],
  ["createComponentRegistry", "component"]
]);
const conventionalReceiverTypes = new Map([
  ["signals", "signal"],
  ["signalRegistry", "signal"],
  ["handlers", "handler"],
  ["handlerRegistry", "handler"],
  ["server", "server"],
  ["serverRegistry", "server"],
  ["partials", "partial"],
  ["partialRegistry", "partial"],
  ["routes", "route"],
  ["routeRegistry", "route"],
  ["components", "component"],
  ["componentRegistry", "component"]
]);

export async function lintRegistry(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const includeDirs = options.includeDirs ?? defaultIncludeDirs;
  const types = new Set(options.types ?? defaultTypes);
  const cachePath = resolve(root, options.cachePath ?? ".async/registry-lint-cache.json");
  const manifestPath = resolve(root, options.manifestPath ?? ".async/registry-manifest.json");
  const useCache = options.cache !== false;
  const writeManifest = options.manifest !== false;
  const files = await collectJavaScriptFiles(root, includeDirs);
  const cache = useCache ? await readJson(cachePath) : null;
  const nextCache = {
    version: cacheVersion,
    files: {}
  };
  const entries = [];
  let parsed = 0;
  let reused = 0;

  for (const file of files) {
    const absolutePath = resolve(root, file);
    const source = await readFile(absolutePath, "utf8");
    const hash = sha256(source);
    const cached = cache?.version === cacheVersion ? cache.files?.[file] : null;
    let fileEntries;

    if (useCache && cached?.hash === hash && Array.isArray(cached.entries)) {
      fileEntries = cached.entries;
      reused += 1;
    } else {
      fileEntries = parseRegistryEntries(source, file);
      parsed += 1;
    }

    nextCache.files[file] = {
      hash,
      entries: fileEntries
    };
    entries.push(...fileEntries.filter((entry) => types.has(entry.type)));
  }

  const { conflicts, duplicates } = analyzeEntries(entries);
  const manifest = {
    version: manifestVersion,
    generatedAt: new Date().toISOString(),
    root,
    includes: includeDirs,
    excludes: [
      "browser.js",
      "browser.min.js",
      "browser.umd.js",
      "browser.umd.min.js",
      "browser.ts",
      "browser.d.ts",
      "server.d.ts"
    ],
    cache: {
      path: relative(root, cachePath),
      enabled: useCache,
      parsed,
      reused,
      totalFiles: files.length
    },
    entries,
    duplicates,
    conflicts
  };

  if (useCache) {
    await writeJson(cachePath, nextCache);
  }
  if (writeManifest) {
    await writeJson(manifestPath, manifest);
  }

  return manifest;
}

export function parseRegistryEntries(source, file) {
  const receiverTypes = inferReceiverTypes(source);
  return [
    ...parseUseCalls(source, file),
    ...parseRegistryInitializers(source, file),
    ...parseRegisterCalls(source, file, receiverTypes),
    ...parseAsyncSignalCalls(source, file, receiverTypes)
  ];
}

function parseUseCalls(source, file) {
  const entries = [];
  for (const call of findCalls(source, ".use")) {
    const args = splitArguments(call.body, call.open + 1);
    if (args.length === 1) {
      entries.push(...parseUseModule(args[0], file, call.open + 1));
      continue;
    }

    const type = readStringLiteral(args[0]?.source);
    if (type && defaultTypes.has(type)) {
      entries.push(...parseRegistryMap(type, args[1]?.source, file, args[1]?.start ?? call.open + 1, "use"));
    }
  }
  return entries;
}

function parseUseModule(arg, file, offset) {
  const entries = [];
  const groups = parseObjectEntries(arg.source, offset);
  for (const group of groups) {
    if (!defaultTypes.has(group.key)) {
      continue;
    }
    entries.push(...parseRegistryMap(group.key, group.value, file, group.valueStart, "use"));
  }
  return entries;
}

function parseRegistryInitializers(source, file) {
  const entries = [];
  for (const [factory, type] of registryFactoryTypes) {
    for (const call of findCalls(source, factory)) {
      const args = splitArguments(call.body, call.open + 1);
      entries.push(...parseRegistryMap(type, args[0]?.source, file, args[0]?.start ?? call.open + 1, "registry"));
    }
  }
  return entries;
}

function parseRegisterCalls(source, file, receiverTypes) {
  const entries = [];
  for (const call of findMemberCalls(source, "register")) {
    const type = receiverTypes.get(call.receiver);
    if (!type) {
      continue;
    }

    const args = splitArguments(call.body, call.open + 1);
    const id = readStringLiteral(args[0]?.source);
    if (!id) {
      continue;
    }

    entries.push(createEntry({
      type,
      id,
      kind: "register",
      content: args[1]?.source ?? "",
      file,
      start: args[0]?.start ?? call.open,
      end: args[1]?.end ?? call.close
    }));
  }
  return entries;
}

function parseAsyncSignalCalls(source, file, receiverTypes) {
  const entries = [];
  for (const call of findMemberCalls(source, "asyncSignal")) {
    if (receiverTypes.get(call.receiver) !== "signal") {
      continue;
    }

    const args = splitArguments(call.body, call.open + 1);
    const id = readStringLiteral(args[0]?.source);
    if (!id) {
      continue;
    }

    entries.push(createEntry({
      type: "signal",
      id,
      kind: "asyncSignal",
      content: args[1]?.source ?? "",
      file,
      start: args[0]?.start ?? call.open,
      end: args[1]?.end ?? call.close
    }));
  }
  return entries;
}

function parseRegistryMap(type, source, file, offset, kind) {
  if (!source?.trim().startsWith("{")) {
    return [];
  }

  return parseObjectEntries(source, offset)
    .filter((entry) => entry.key)
    .map((entry) => createEntry({
      type,
      id: entry.key,
      kind,
      content: entry.value,
      file,
      start: entry.start,
      end: entry.end
    }));
}

function createEntry({ type, id, kind, content, file, start, end }) {
  const normalized = normalizeContent(content);
  return {
    type,
    id,
    kind,
    file,
    startLine: lineForOffset(contentSourceCache.get(file), start),
    endLine: lineForOffset(contentSourceCache.get(file), end),
    contentHash: sha256(normalized),
    sourceHash: sha256(content),
    size: normalized.length
  };
}

function analyzeEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = `${entry.type}:${entry.id}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  }

  const conflicts = [];
  const duplicates = [];
  for (const [key, group] of groups) {
    if (group.length < 2) {
      continue;
    }
    const [type, id] = key.split(":");
    const hashes = new Set(group.map((entry) => entry.contentHash));
    const record = {
      type,
      id,
      count: group.length,
      locations: group.map(({ file, startLine, endLine, contentHash }) => ({ file, startLine, endLine, contentHash }))
    };
    if (hashes.size > 1) {
      conflicts.push(record);
    } else {
      duplicates.push(record);
    }
  }

  return { conflicts, duplicates };
}

const contentSourceCache = new Map();

async function collectJavaScriptFiles(root, includeDirs) {
  const files = [];
  for (const dir of includeDirs) {
    await collectFromDir(root, resolve(root, dir), files);
  }
  return files.sort();
}

async function collectFromDir(root, dir, files) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    const relativePath = relative(root, absolutePath).split(sep).join("/");
    if (shouldSkip(relativePath)) {
      continue;
    }
    if (entry.isDirectory()) {
      await collectFromDir(root, absolutePath, files);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".js")) {
      const source = await readFile(absolutePath, "utf8");
      contentSourceCache.set(relativePath, source);
      files.push(relativePath);
    }
  }
}

function shouldSkip(relativePath) {
  return (
    relativePath.startsWith(".git/") ||
    relativePath.startsWith(".async/") ||
    relativePath.startsWith("node_modules/") ||
    /^browser(?:\.min|\.umd|\.umd\.min)?\.(?:js|ts|d\.ts)$/.test(relativePath) ||
    relativePath === "server.d.ts"
  );
}

function inferReceiverTypes(source) {
  const receivers = new Map(conventionalReceiverTypes);
  for (const [factory, type] of registryFactoryTypes) {
    const pattern = new RegExp(`(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${factory}\\s*\\(`, "g");
    for (const match of source.matchAll(pattern)) {
      receivers.set(match[1], type);
    }
  }
  return receivers;
}

function findCalls(source, name) {
  const calls = [];
  let index = 0;
  while ((index = source.indexOf(`${name}(`, index)) !== -1) {
    const open = index + name.length;
    const close = findMatching(source, open, "(", ")");
    if (close !== -1) {
      calls.push({
        open,
        close,
        body: source.slice(open + 1, close)
      });
      index = close + 1;
    } else {
      index += name.length + 1;
    }
  }
  return calls;
}

function findMemberCalls(source, method) {
  const calls = [];
  const pattern = new RegExp(`\\b([A-Za-z_$][\\w$]*)\\s*\\.\\s*${method}\\s*\\(`, "g");
  for (const match of source.matchAll(pattern)) {
    const open = source.indexOf("(", match.index);
    const close = findMatching(source, open, "(", ")");
    if (close === -1) {
      continue;
    }
    calls.push({
      receiver: match[1],
      open,
      close,
      body: source.slice(open + 1, close)
    });
  }
  return calls;
}

function splitArguments(source, offset = 0) {
  return splitTopLevel(source, offset).map((part) => ({
    ...part,
    source: part.source.trim()
  })).filter((part) => part.source.length > 0);
}

function parseObjectEntries(source, offset = 0) {
  const trimmedStart = source.search(/\S/);
  if (trimmedStart === -1 || source[trimmedStart] !== "{") {
    return [];
  }
  const open = trimmedStart;
  const close = findMatching(source, open, "{", "}");
  if (close === -1) {
    return [];
  }
  const innerStart = open + 1;
  const inner = source.slice(innerStart, close);
  return splitTopLevel(inner, offset + innerStart)
    .map((part) => parseObjectEntry(part))
    .filter(Boolean);
}

function parseObjectEntry(part) {
  const source = part.source.trim();
  if (!source || source.startsWith("...") || source.startsWith("[")) {
    return null;
  }

  const leading = part.source.length - part.source.trimStart().length;
  const start = part.start + leading;
  const key = readPropertyKey(source);
  if (!key) {
    return null;
  }

  const valueStart = findPropertyValueStart(source);
  const value = valueStart === -1 ? source : source.slice(valueStart).trim();
  return {
    key,
    value,
    valueStart: start + (valueStart === -1 ? 0 : valueStart),
    start,
    end: part.end
  };
}

function readPropertyKey(source) {
  let rest = source.trimStart();
  if (rest.startsWith("async ")) {
    rest = rest.slice("async ".length).trimStart();
  }
  if (rest.startsWith("\"") || rest.startsWith("'")) {
    return readStringLiteral(rest);
  }
  const match = rest.match(/^([A-Za-z_$][\w$-]*)/);
  return match?.[1] ?? null;
}

function findPropertyValueStart(source) {
  const colon = findTopLevelToken(source, ":");
  if (colon !== -1) {
    return colon + 1;
  }
  const method = findTopLevelToken(source, "(");
  return method;
}

function findTopLevelToken(source, token) {
  return splitScanner(source, {
    onChar(char, index, depth) {
      if (depth === 0 && char === token) {
        return index;
      }
      return undefined;
    }
  }) ?? -1;
}

function splitTopLevel(source, offset = 0) {
  const parts = [];
  let start = 0;
  splitScanner(source, {
    onChar(char, index, depth) {
      if (depth === 0 && char === ",") {
        parts.push({
          source: source.slice(start, index),
          start: offset + start,
          end: offset + index
        });
        start = index + 1;
      }
      return undefined;
    }
  });
  parts.push({
    source: source.slice(start),
    start: offset + start,
    end: offset + source.length
  });
  return parts;
}

function findMatching(source, open, openChar, closeChar) {
  let depth = 0;
  return splitScanner(source, {
    start: open,
    onChar(char, index) {
      if (char === openChar) {
        depth += 1;
      }
      if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return index;
        }
      }
      return undefined;
    }
  }) ?? -1;
}

function splitScanner(source, { start = 0, onChar }) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (char === "\"" || char === "'") {
      index = skipQuoted(source, index, char);
      continue;
    }
    if (char === "`") {
      index = skipTemplate(source, index);
      continue;
    }
    if (char === "/" && next === "/") {
      index = skipLineComment(source, index);
      continue;
    }
    if (char === "/" && next === "*") {
      index = skipBlockComment(source, index);
      continue;
    }

    const result = onChar(char, index, depth);
    if (result !== undefined) {
      return result;
    }

    if (char === "{" || char === "[" || char === "(") {
      depth += 1;
    } else if (char === "}" || char === "]" || char === ")") {
      depth -= 1;
    }
  }
  return undefined;
}

function skipQuoted(source, start, quote) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === quote) {
      return index;
    }
  }
  return source.length - 1;
}

function skipTemplate(source, start) {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === "\\") {
      index += 1;
      continue;
    }
    if (source[index] === "`") {
      return index;
    }
  }
  return source.length - 1;
}

function skipLineComment(source, start) {
  const next = source.indexOf("\n", start + 2);
  return next === -1 ? source.length - 1 : next;
}

function skipBlockComment(source, start) {
  const next = source.indexOf("*/", start + 2);
  return next === -1 ? source.length - 1 : next + 1;
}

function readStringLiteral(source) {
  const trimmed = source?.trim();
  if (!trimmed || !(trimmed.startsWith("\"") || trimmed.startsWith("'"))) {
    return null;
  }
  const quote = trimmed[0];
  let value = "";
  for (let index = 1; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "\\") {
      value += trimmed[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (char === quote) {
      return value;
    }
    value += char;
  }
  return null;
}

function normalizeContent(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lineForOffset(source = "", offset = 0) {
  return source.slice(0, Math.max(0, offset)).split("\n").length;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--no-cache") {
      options.cache = false;
    } else if (arg === "--no-manifest") {
      options.manifest = false;
    } else if (arg === "--root") {
      options.root = argv[++index];
    } else if (arg === "--cache") {
      options.cachePath = argv[++index];
    } else if (arg === "--manifest") {
      options.manifestPath = argv[++index];
    } else if (arg === "--include") {
      options.includeDirs = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
    } else if (arg === "--types") {
      options.types = argv[++index].split(",").map((item) => item.trim()).filter(Boolean);
    } else {
      throw new Error(`Unknown option "${arg}".`);
    }
  }
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const manifest = await lintRegistry(options);
  if (options.json) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    process.stdout.write(
      `registry-lint: ${manifest.entries.length} entries, ${manifest.duplicates.length} duplicate groups, ${manifest.conflicts.length} conflicts\n`
    );
    if (manifest.manifest !== false) {
      process.stdout.write(`registry-lint: wrote ${manifestPathLabel(options)}\n`);
    }
  }

  if (manifest.conflicts.length > 0) {
    for (const conflict of manifest.conflicts) {
      process.stderr.write(`Registry ${conflict.type} "${conflict.id}" has conflicting registrations:\n`);
      for (const location of conflict.locations) {
        process.stderr.write(`  - ${location.file}:${location.startLine} (${location.contentHash.slice(0, 12)})\n`);
      }
    }
    process.exitCode = 1;
  }
}

function manifestPathLabel(options) {
  return options.manifestPath ?? ".async/registry-manifest.json";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
