import { spawn } from "node:child_process";

export async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.json();
}

export async function isServerReady(host, port) {
  try {
    await fetchJson(`http://${host}:${port}/ls`);
    return true;
  } catch {
    return false;
  }
}

export async function ensureServer({ benchmarkRoot, host, port }) {
  if (await isServerReady(host, port)) {
    return { started: false, close: async () => {} };
  }

  let closing = false;
  const child = spawn("npm", ["start"], {
    cwd: benchmarkRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(port) },
    detached: true,
  });
  child.stdout.on("data", (chunk) => {
    if (!closing) process.stdout.write(`[benchmark-server] ${chunk}`);
  });
  child.stderr.on("data", (chunk) => {
    if (!closing) process.stderr.write(`[benchmark-server] ${chunk}`);
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    if (await isServerReady(host, port)) {
      return {
        started: true,
        close: async () => {
          closing = true;
          await stopChildProcess(child);
        },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  closing = true;
  await stopChildProcess(child);
  throw new Error(`Benchmark server did not become ready at http://${host}:${port}/ls`);
}

async function stopChildProcess(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const closed = new Promise((resolve) => child.once("close", resolve));
  const signalGroup = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      child.kill(signal);
    }
  };
  signalGroup("SIGINT");
  if (await Promise.race([closed.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 2_000))])) return;
  signalGroup("SIGTERM");
  if (await Promise.race([closed.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 2_000))])) return;
  signalGroup("SIGKILL");
  await closed;
}
