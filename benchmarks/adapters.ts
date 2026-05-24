import { computed as v0Computed, signal as v0Signal } from "@async/framework-v0/signals";
import { computed as v1Computed, signal as v1Signal } from "@async/framework-v1/signals";

type SignalLike<T> = {
  value: T;
};

type BenchmarkAdapter = {
  name: string;
  signal: <T>(initialValue: T) => SignalLike<T>;
  computed: (calc: () => number) => SignalLike<number>;
};

export const benchmarkAdapters: BenchmarkAdapter[] = [
  {
    name: "v0",
    signal: v0Signal,
    computed: v0Computed,
  },
  {
    name: "v1",
    signal: v1Signal,
    computed: v1Computed,
  },
];

export type { BenchmarkAdapter };
