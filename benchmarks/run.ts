import { mkdir, writeFile } from "node:fs/promises";
import { benchmarkAdapters } from "./adapters.ts";
import { runSignalsScenario, type ScenarioResult } from "./scenarios/signals.ts";

type CliOptions = {
  scenario: "signals";
  runs?: number;
  iterations?: number;
};

type BenchmarkReport = {
  generatedAt: string;
  scenario: "signals";
  runs: number;
  iterations: number;
  results: ScenarioResult[];
};

function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = { scenario: "signals" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--scenario" && args[i + 1] === "signals") {
      options.scenario = "signals";
      i++;
      continue;
    }
    if (arg === "--runs" && args[i + 1]) {
      options.runs = Number(args[i + 1]);
      i++;
      continue;
    }
    if (arg === "--iterations" && args[i + 1]) {
      options.iterations = Number(args[i + 1]);
      i++;
      continue;
    }
  }

  return options;
}

function asReadableInteger(value: number): string {
  return Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function printResultLine(result: ScenarioResult): void {
  console.log(
    [
      result.framework.padEnd(5, " "),
      `signal writes/sec: ${asReadableInteger(result.signalWriteOpsPerSec).padStart(10, " ")}`,
      `computed reads/sec: ${asReadableInteger(result.computedReadOpsPerSec).padStart(10, " ")}`,
    ].join(" | "),
  );
}

async function saveReport(report: BenchmarkReport): Promise<string> {
  const safeTimestamp = report.generatedAt.replaceAll(":", "-");
  const outputDir = "benchmarks/results";
  const outputPath = `${outputDir}/${safeTimestamp}.json`;
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return outputPath;
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  const results = benchmarkAdapters.map((adapter) =>
    runSignalsScenario(adapter, {
      runs: options.runs,
      iterations: options.iterations,
    })
  );

  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    scenario: options.scenario,
    runs: results[0]?.runs ?? 0,
    iterations: results[0]?.iterations ?? 0,
    results,
  };

  console.log(`Scenario: ${report.scenario}`);
  console.log(
    `Runs: ${report.runs} | Iterations per run: ${asReadableInteger(report.iterations)}`,
  );
  console.log("---");
  report.results.forEach(printResultLine);

  const outputPath = await saveReport(report);
  console.log("---");
  console.log(`Saved benchmark report: ${outputPath}`);
}

await main();
