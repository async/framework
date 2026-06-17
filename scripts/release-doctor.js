#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const NPM_REGISTRY = "https://registry.npmjs.org";
const SHA_PATTERN = /^[0-9a-f]{40}$/;

main().catch((error) => {
  console.error(`::error::${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

async function main() {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const changelog = await readFile(new URL("../CHANGELOG.md", import.meta.url), "utf8");
  const version = manifest.version;
  const tagName = `v${version}`;
  const expectedSha = expectedGitSha();
  const releaseBody = readReleaseBody(changelog, version);
  const repository = process.env.GITHUB_REPOSITORY ?? packageRepositoryName(manifest);

  if (!repository) {
    throw new Error("Set GITHUB_REPOSITORY or package.json repository so release doctor can resolve GitHub state.");
  }

  const npmInfo = await waitForNpmPackage(manifest.name, version);
  if (npmInfo.gitHead && npmInfo.gitHead !== expectedSha) {
    throw new Error(`npm gitHead for ${manifest.name}@${version} is ${npmInfo.gitHead}; expected ${expectedSha}.`);
  }
  console.log(`OK npm: ${manifest.name}@${version}`);

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Set GITHUB_TOKEN so release doctor can verify the GitHub Release.");
  }

  const release = await githubApi(repository, `/releases/tags/${encodeURIComponent(tagName)}`, token);
  const tagSha = await githubTagSha(repository, tagName, token);
  if (tagSha !== expectedSha) {
    throw new Error(`Git tag ${tagName} points to ${tagSha}; expected ${expectedSha}.`);
  }
  console.log(`OK Git tag: ${repository}@${tagName}`);

  if (!normalizeReleaseBody(release.body ?? "").includes(normalizeReleaseBody(releaseBody))) {
    throw new Error(`GitHub Release ${tagName} description does not include the CHANGELOG.md entry.`);
  }
  console.log(`OK GitHub Release: ${repository}@${tagName}`);
  console.log(`Release doctor passed for ${manifest.name}@${version}.`);
}

async function waitForNpmPackage(name, version) {
  const spec = `${name}@${version}`;
  const attempts = positiveInt(process.env.ASYNC_PIPELINE_RELEASE_DOCTOR_REGISTRY_ATTEMPTS, 12);
  const delayMs = positiveInt(process.env.ASYNC_PIPELINE_RELEASE_DOCTOR_REGISTRY_RETRY_DELAY_MS, 5000);
  let last;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const view = spawnSync("npm", ["view", spec, "version", "gitHead", "--json", "--registry", NPM_REGISTRY], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? ".async/npm-cache"
      }
    });
    last = view;
    if (view.status === 0) {
      const info = JSON.parse(view.stdout);
      if (info.version !== version) {
        throw new Error(`npm returned ${info.version} for ${spec}.`);
      }
      return info;
    }
    if (!isMissingVersion(view) || attempt === attempts) {
      throw new Error(`Release doctor could not find ${spec} on npm: ${npmOutput(view).slice(0, 500)}`);
    }
    console.log(`Waiting for npm to expose ${spec} (${attempt}/${attempts}).`);
    await sleep(delayMs);
  }

  throw new Error(`Release doctor could not find ${spec} on npm: ${npmOutput(last).slice(0, 500)}`);
}

async function githubTagSha(repository, tagName, token) {
  const ref = await githubApi(repository, `/git/ref/tags/${encodeURIComponent(tagName)}`, token);
  const object = ref.object ?? {};
  if (object.type === "commit" && typeof object.sha === "string") {
    return object.sha;
  }
  if (object.type === "tag" && typeof object.sha === "string") {
    const tag = await githubApi(repository, `/git/tags/${object.sha}`, token);
    if (tag.object?.type === "commit" && typeof tag.object.sha === "string") {
      return tag.object.sha;
    }
  }
  throw new Error(`Git tag ${tagName} points to an unsupported Git object.`);
}

async function githubApi(repository, path, token) {
  const apiBase = (process.env.GITHUB_API_URL ?? "https://api.github.com").replace(/\/$/, "");
  const response = await fetch(`${apiBase}/repos/${repository}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28"
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API GET /repos/${repository}${path} failed with ${response.status}: ${text.slice(0, 500)}`);
  }
  return response.json();
}

function expectedGitSha() {
  if (SHA_PATTERN.test(process.env.GITHUB_SHA ?? "")) {
    return process.env.GITHUB_SHA;
  }
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0 || !SHA_PATTERN.test(result.stdout.trim())) {
    throw new Error("Could not resolve the expected release commit SHA.");
  }
  return result.stdout.trim();
}

function readReleaseBody(changelog, version) {
  const start = changelog.indexOf(`## ${version} - `);
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no "## ${version} - <date>" entry.`);
  }
  const bodyStart = changelog.indexOf("\n", start) + 1;
  const next = changelog.indexOf("\n## ", bodyStart);
  const body = changelog.slice(bodyStart, next === -1 ? undefined : next).trim();
  if (!body) {
    throw new Error(`CHANGELOG.md entry for ${version} is empty.`);
  }
  return body;
}

function packageRepositoryName(manifest) {
  const repository = manifest.repository;
  const url = typeof repository === "string"
    ? repository
    : repository && typeof repository.url === "string"
      ? repository.url
      : undefined;
  const match = url?.match(/github\.com[:/]([^/\s]+)\/([^/\s.]+)(?:\.git)?/i);
  return match ? `${match[1]}/${match[2]}` : undefined;
}

function normalizeReleaseBody(value) {
  return String(value).replace(/\r\n/g, "\n").trim();
}

function isMissingVersion(result) {
  const output = npmOutput(result);
  return /E404|404 Not Found|is not in this registry|No match found/.test(output);
}

function npmOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join("\n");
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
