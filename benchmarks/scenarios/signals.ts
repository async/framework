import type { BenchmarkAdapter } from "../adapters.ts";

type ScenarioResult = {
  scenario: "signals";
  framework: string;
  signalWriteOpsPerSec: number;
  computedReadOpsPerSec: number;
  runs: number;
  iterations: number;
};

const defaultRuns = 8;
const defaultIterations = 20_000;

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function measureOpsPerSec(run: () => void, iterations: number): number {
  const startedAt = performance.now();
  run();
  const elapsedMs = Math.max(0.1, performance.now() - startedAt);
  return (iterations / elapsedMs) * 1_000;
}

export function runSignalsScenario(
  adapter: BenchmarkAdapter,
  options?: { runs?: number; iterations?: number },
): ScenarioResult {
  const runs = options?.runs ?? defaultRuns;
  const iterations = options?.iterations ?? defaultIterations;

  const signalWriteSamples: number[] = [];
  const computedReadSamples: number[] = [];

  for (let runIndex = 0; runIndex < runs; runIndex++) {
    const counter = adapter.signal(0);
    signalWriteSamples.push(
      measureOpsPerSec(() => {
        for (let i = 0; i < iterations; i++) {
          counter.value = i;
        }
      }, iterations),
    );

    const source = adapter.signal(0);
    const doubled = adapter.computed(() => source.value * 2);
    computedReadSamples.push(
      measureOpsPerSec(() => {
        let checksum = 0;
        for (let i = 0; i < iterations; i++) {
          source.value = i;
          checksum += doubled.value;
        }

        if (checksum < 0) {
          throw new Error("unreachable");
        }
      }, iterations),
    );
  }

  return {
    scenario: "signals",
    framework: adapter.name,
    signalWriteOpsPerSec: Number(average(signalWriteSamples).toFixed(2)),
    computedReadOpsPerSec: Number(average(computedReadSamples).toFixed(2)),
    runs,
    iterations,
  };
}

export type { ScenarioResult };
