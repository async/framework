// @ts-check
import { takeWhile } from "./utils/index.js";
import { getFrameworks } from "./helpers/frameworks.js";
import { rebuildFramework } from "./helpers/rebuild-utils.js";

/*
This script rebuilds all frameworks from scratch,
it deletes all package.json and package-lock.json files
and invokes npm install and npm run build-prod for all benchmarks 

If building a framework fails you can resume building like
npm run build-all -- --restart-with-app react
*/

/**
 * @typedef {Object} Framework
 * @property {string} name - Name of the app
 */

/**
 * @param {Framework} framework
 * @param {string} restartWithFramework
 * @returns {boolean}
 */
function shouldSkipFramework({ name }, restartWithApp) {
  if (!restartWithApp) return false;
  return !name.startsWith(restartWithApp);
}

/**
 * @param {Object} options
 * @param {string} options.restartWithApp
 * @param {boolean} options.useCi
 */
export function rebuildAllFrameworks({ restartWithApp, useCi }) {
  console.log(`Build all apps. ci: ${useCi}, restartWith: ${restartWithApp}`);

  let frameworks = getFrameworks();
  const skippableFrameworks = takeWhile(frameworks, (framework) =>
    shouldSkipFramework(framework, restartWithApp)
  );
  const buildableFrameworks = frameworks.slice(skippableFrameworks.length);

  for (const framework of buildableFrameworks) {
    rebuildFramework(framework.name, useCi);
  }

  console.log("All apps were built!");
}
