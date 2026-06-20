// @ts-check
import * as fs from "node:fs";
import path from "node:path";

const filesToDelete = ["package-lock.json", "yarn-lock", "dist", "elm-stuff", "bower_components", "node_modules"];

/**
 * Delete specified files in the framework directory
 * @param {string} frameworkPath
 * @param {string[]} filesToDelete
 */
function deleteFrameworkFiles(frameworkPath, filesToDelete) {
  for (const file of filesToDelete) {
    const filePath = path.join(frameworkPath, file);
    fs.rmSync(filePath, { force: true, recursive: true });
  }
  console.log(`Deleted: ${filesToDelete}`);
}

/**
 * Cleans app directories of package-lock.json, yarn-lock, node_modules, and dist output.
 * @param {Object} options
 * @param {string} options.appsDirPath
 */
export function cleanFrameworkDirectories({ appsDirPath }) {
  console.log("Clean app directories", "appsDirPath", appsDirPath);

  for (const directory of fs.readdirSync(path.resolve(appsDirPath))) {
    const frameworkPath = path.resolve(appsDirPath, directory);
    console.log(`cleaning ${frameworkPath}`);
    deleteFrameworkFiles(frameworkPath, filesToDelete);
  }
}
