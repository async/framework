// @ts-check
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import path from "node:path";
import { validateLockfileUrls } from "./lockfile-validation.js";

/**
 * Run a command synchronously in the specified directory and log command
 * @param {string} command - The command to run
 * @param {string|undefined} cwd - The current working directory (optional)
 */
function runCommand(command, cwd) {
  console.log(`running '${command}' in '${cwd}'`);
  if (cwd && !fs.existsSync(cwd)) {
    throw `working directory ${cwd} doesn't exist.`;
  }

  execSync(command, { stdio: "inherit", cwd });
}

/**
 * Delete specified files in the framework directory
 * @param {string} frameworkPath
 * @param {string[]} filesToDelete
 */
function deleteFrameworkFiles(frameworkPath, filesToDelete) {
  for (const file of filesToDelete) {
    const filePath = path.join(frameworkPath, file);
    fs.rmSync(filePath, { recursive: true, force: true });
  }
  console.log(`Deleted: ${filesToDelete}`);
}

/**
 * Build a single app.
 * @param {string} app
 * @param {boolean} useCi
 * @returns {boolean} true if the build succeeded, false otherwise
 */
export function rebuildFramework(app, useCi) {
  const frameworkPath = path.join("apps", app);
  const packageJSONPath = path.join(frameworkPath, "package.json");

  if (!fs.existsSync(packageJSONPath)) {
    console.log(`WARN: skipping ${app} since there's no package.json`);
    return true;
  }

  console.log("Building app", app);

  if (useCi) {
    const { valid, violations } = validateLockfileUrls(frameworkPath);
    if (!valid) {
      console.log(`ERROR: package-lock.json for ${app} contains resolved URLs pointing to non-allowed registries:`);
      for (const v of violations) {
        console.log(`  ${v}`);
      }
      console.log("Only https://registry.npmjs.org/ is allowed.");
      return false;
    }
  }

  const filesToDelete = ["yarn-lock", "dist", "elm-stuff", "bower_components", "node_modules", "output"].concat(
    useCi ? [] : ["package-lock.json"]
  );

  deleteFrameworkFiles(frameworkPath, filesToDelete);

  const installCmd = `npm ${useCi ? "ci" : "install"} --ignore-scripts`;
  runCommand(installCmd, frameworkPath);

  const buildCmd = "npm run build-prod";
  runCommand(buildCmd, frameworkPath);
  return true;
}
