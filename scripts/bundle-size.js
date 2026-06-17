#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");

const source = await size("browser.ts");
const esmMin = await size("browser.min.js");
const umdMin = await size("browser.umd.min.js");
const diff = {
  raw: esmMin.raw - source.raw,
  gzip: esmMin.gzip - source.gzip
};

const changelogLine = `- Bundle size from bundled TypeScript source: \`browser.ts\` ${format(source.raw)} B raw /
  ${format(source.gzip)} B gzip -> \`browser.min.js\` ${format(esmMin.raw)} B raw / ${format(esmMin.gzip)} B gzip
  (${formatSigned(diff.raw)} B raw, ${formatSigned(diff.gzip)} B gzip).`;

if (check) {
  const changelog = await readFile(join(root, "CHANGELOG.md"), "utf8");
  if (!changelog.includes(changelogLine)) {
    console.error("CHANGELOG.md bundle size note is stale. Expected:");
    console.error(changelogLine);
    process.exitCode = 1;
  }
} else {
  console.log(changelogLine);
  console.log(`browser.umd.min.js: ${format(umdMin.raw)} B raw / ${format(umdMin.gzip)} B gzip`);
}

async function size(file) {
  const buffer = await readFile(join(root, file));
  return {
    raw: buffer.byteLength,
    gzip: gzipSync(buffer, { level: 9 }).byteLength
  };
}

function format(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSigned(value) {
  const formatted = format(Math.abs(value));
  return value < 0 ? `-${formatted}` : `+${formatted}`;
}
