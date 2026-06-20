// @ts-check
import { rebuildFramework } from "./helpers/rebuild-utils.js";

export { rebuildFramework };

/*
build-apps [--ci] [app1 ... appN]

This script rebuilds a single framework
By default it rebuilds from scratch, deletes all package.json and package-lock.json files
and invokes npm install and npm run build-prod for the benchmark

With argument --ci it rebuilds using the package-lock.json dependencies, i.e.
it calls npm ci and npm run build-prod for the benchmark

Pass list of apps.
*/

/**
 * @param {string[]} apps
 * @param {boolean} useCi
 */
export function rebuildFrameworks(apps, useCi) {
  console.log("Build apps: useCi", useCi, "apps", apps);

  if (apps.length === 0) {
    console.log("ERROR: Missing arguments. Command: build-apps js-only react qwik-v1 ...");
    return false;
  }

  for (const app of apps) {
    if (!rebuildFramework(app, useCi)) {
      return false;
    }
  }

  console.log("Build finished successfully.");
  return true;
}
