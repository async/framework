// @ts-check
import * as fs from "node:fs";
import path from "node:path";

/**
 * @typedef {Object} Framework
 * @property {string} name - Name of the app (e.g., "react", "qwik-v1")
 */

/**
 * Returns an array with arrays of types and names of frameworks
 * @param {string} frameworksDirPath
 * @param {Array<string>} frameworksTypes
 * @returns {Framework[]}
 */
export function getFrameworks(appsDirPath = "apps") {
  return fs.readdirSync(appsDirPath).map((app) => ({ name: app }));
}
