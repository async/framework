import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runnerRoot = path.resolve(__dirname, "..");

function formatNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

async function main() {
  if (process.argv.includes("--help")) {
    console.log("Usage: node src/results.js [runner/results/latest.json]");
    return;
  }
  const resultPath = path.resolve(process.argv[2] ?? path.join(runnerRoot, "results", "latest.json"));
  const data = JSON.parse(await readFile(resultPath, "utf8"));
  console.log(`Modern benchmark results: ${data.generatedAt} (${data.mode}, ${data.browser})`);
  console.log("framework\tbenchmark\ttotal(ms)\tscript(ms)\tpaint(ms)\tmemory(MB)\tbr(bytes)");
  for (const result of data.results) {
    console.log(
      [
        result.framework,
        result.benchmark,
        formatNumber(result.summary.total?.mean),
        formatNumber(result.summary.script?.mean),
        formatNumber(result.summary.paint?.mean),
        formatNumber(result.summary.memoryMB?.mean),
        result.size?.brBytes ?? "-",
      ].join("\t")
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
