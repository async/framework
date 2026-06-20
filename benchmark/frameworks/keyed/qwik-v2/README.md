# Qwik

Please note that this benchmark does not test the true power of Qwik, namely resumability. So the expected result is that Qwik is average in this benchmark, but it is much faster in real world applications.

See https://qwik.dev/docs/concepts/think-qwik/

## Build

The Qwik 2 beta build mirrors the Qwik 1 benchmark layout: Qwik Router routes,
SSR/preview entrypoints, and a static adapter build.

The serving location for the benchmark is `/dist`. Qwik Router 2 currently
writes SSG output there directly, while Qwik 1 writes the full benchmark path
and moves it back into `/dist`.
