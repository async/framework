import path from "node:path";
import * as fs from "node:fs";

import { appsDirectory } from "../config/directories.js";
import { buildFrameworkVersionString, copyProps } from "./helpers/index.js";
import { BenchmarkData, Result } from "./types/index.js";

function isErrorWithCode(err: unknown): err is Error & { code: unknown } {
  return err instanceof Error && "code" in err;
}

class PackageJSONProvider {
  #appsDir;

  constructor(appsDir: string) {
    this.#appsDir = appsDir;
  }

  async getPackageJSON(framework: string) {
    try {
      const packageJSONPath = path.join(this.#appsDir, framework, "package.json");
      const packageJSON = await fs.promises.readFile(packageJSONPath, "utf8");
      return JSON.parse(packageJSON);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(`Package.json not found for ${framework}.`);
      }
      console.error(`error in ${framework} ${error}`);
    }
  }

  async getPackageLockJSON(framework: string) {
    try {
      const packageLockJSONPath = path.join(this.#appsDir, framework, "package-lock.json");
      const packageLockJSON = await fs.promises.readFile(packageLockJSONPath, "utf8");
      return JSON.parse(packageLockJSON);
    } catch (error) {
      if (isErrorWithCode(error) && error.code === "ENOENT") {
        throw new Error(`Package-lock.json not found for ${framework}.`);
      }
      console.error(`error in ${framework} ${error}`);
    }
  }
}

function isFrameworkDir(framework: string): boolean {
  const frameworkPath = path.resolve(appsDirectory, framework);
  const packageJSONPath = path.resolve(frameworkPath, "package.json");
  const packageLockJSONPath = path.resolve(frameworkPath, "package-lock.json");

  return fs.existsSync(packageJSONPath) && fs.existsSync(packageLockJSONPath);
}

const packageJSONProvider = new PackageJSONProvider(appsDirectory);
const rootPackageJSONPath = path.resolve(appsDirectory, "..", "..", "package.json");

/**
 * Load framework information from package.json and package-lock.json files.
 */
export async function loadFrameworkInfo(framework: string) {
  const result: Result = {
    type: "app",
    directory: framework,
  };
  const packageJSON = await packageJSONProvider.getPackageJSON(framework);
  const packageLockJSON = await packageJSONProvider.getPackageLockJSON(framework);

  const benchmarkData: Partial<BenchmarkData> = packageJSON["async-framework-benchmark"];
  if (!benchmarkData) {
    result.error = "package.json must contain an 'async-framework-benchmark' property";
    return result;
  }

  if (benchmarkData.frameworkVersionFromPackage) {
    const packageNames = benchmarkData.frameworkVersionFromPackage.split(":");
    const versions: Required<Result>["versions"] = {};

    for (const packageName of packageNames) {
      const packageVersion =
        packageLockJSON.dependencies?.[packageName]?.version ||
        packageLockJSON.packages?.[`node_modules/${packageName}`]?.version ||
        "ERROR: Not found in package-lock";
      versions[packageName] = packageVersion;
    }

    result.frameworkVersionString = buildFrameworkVersionString(
      framework,
      packageNames.map((name) => versions[name]).join(" + ")
    );

    result.versions = versions;

    copyProps(result, benchmarkData);
  } else if (benchmarkData.frameworkVersionFromRootPackage) {
    const rootPackageJSON = JSON.parse(await fs.promises.readFile(rootPackageJSONPath, "utf8"));
    if (rootPackageJSON.name !== benchmarkData.frameworkVersionFromRootPackage) {
      result.error = `Root package name ${rootPackageJSON.name} does not match ${benchmarkData.frameworkVersionFromRootPackage}`;
      return result;
    }
    if (typeof rootPackageJSON.version !== "string") {
      result.error = "Root package.json must contain a string version";
      return result;
    }

    result.version = rootPackageJSON.version;
    result.frameworkVersionString = buildFrameworkVersionString(framework, rootPackageJSON.version);

    copyProps(result, benchmarkData);
  } else if (typeof benchmarkData.frameworkVersion === "string") {
    result.version = benchmarkData.frameworkVersion;
    result.frameworkVersionString = buildFrameworkVersionString(framework, result.version);

    copyProps(result, benchmarkData);
  } else {
    result.error =
      "package.json must contain a 'frameworkVersionFromPackage' or 'frameworkVersion' in the 'async-framework-benchmark' property";
  }

  return result;
}

export async function loadFrameworkVersions() {
  const resultsProm = [];

  const directories = await fs.promises.readdir(path.resolve(appsDirectory));

  for (const directory of directories) {
    if (!isFrameworkDir(directory)) {
      continue;
    }

    const frameworkInfoPromise = loadFrameworkInfo(directory);
    resultsProm.push(frameworkInfoPromise);
  }

  return Promise.all(resultsProm);
}
