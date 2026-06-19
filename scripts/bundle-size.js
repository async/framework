#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(root, "dist");
const evidenceRoot = join(root, ".async", "release");
const evidencePath = join(evidenceRoot, "evidence.json");
const check = process.argv.includes("--check");

const source = await size("browser.ts");
const esmMin = await size("browser.min.js");
const umdMin = await size("browser.umd.min.js");
const diff = diffSizes(esmMin, source);

const changelogLine = [
  "- Bundle size from bundled TypeScript source: `browser.ts`",
  `${formatSize("raw", source.raw)}, ${formatSize("gzip", source.gzip)}, ${formatSize("br", source.br)}`,
  "-> `browser.min.js`",
  `${formatSize("raw", esmMin.raw)}, ${formatSize("gzip", esmMin.gzip)}, ${formatSize("br", esmMin.br)};`,
  "delta",
  `${formatSignedSize("raw", diff.raw)}, ${formatSignedSize("gzip", diff.gzip)}, ${formatSignedSize("br", diff.br)}.`
].join(" ");

await writeEvidence({ source, esmMin, umdMin, diff, changelogLine });

if (check) {
  const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");
  if (!changelog.includes(changelogLine)) {
    console.error("CHANGELOG.md bundle size note is stale. Expected:");
    console.error(changelogLine);
    process.exitCode = 1;
  }
} else {
  console.log(changelogLine);
  console.log(`browser.umd.min.js: ${formatSize("raw", umdMin.raw)}, ${formatSize("gzip", umdMin.gzip)}, ${formatSize("br", umdMin.br)}`);
}

async function size(file) {
  const buffer = await readFile(join(distRoot, file));
  return {
    raw: buffer.byteLength,
    gzip: gzipSync(buffer, { level: 9 }).byteLength,
    br: brotliCompressSync(buffer, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11
      }
    }).byteLength
  };
}

function diffSizes(after, before) {
  return {
    raw: after.raw - before.raw,
    gzip: after.gzip - before.gzip,
    br: after.br - before.br
  };
}

async function writeEvidence(evidence) {
  await mkdir(evidenceRoot, { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify({
    schemaVersion: 1,
    changelogLine: evidence.changelogLine,
    files: {
      "browser.ts": evidence.source,
      "browser.min.js": evidence.esmMin,
      "browser.umd.min.js": evidence.umdMin
    },
    delta: {
      "browser.ts -> browser.min.js": evidence.diff
    }
  }, null, 2)}\n`, "utf8");
}

function formatSize(label, value) {
  return `${label} ${format(value)} B (${formatDecimal(value / 1_000, 1)} KB / ${formatDecimal(value / 1_000_000, 3)} MB)`;
}

function formatSignedSize(label, value) {
  return `${label} ${formatSigned(value)} B (${formatSignedDecimal(value / 1_000, 1)} KB / ${formatSignedDecimal(value / 1_000_000, 3)} MB)`;
}

function format(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSigned(value) {
  const formatted = format(Math.abs(value));
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}

function formatDecimal(value, digits) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}

function formatSignedDecimal(value, digits) {
  const formatted = formatDecimal(Math.abs(value), digits);
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}
