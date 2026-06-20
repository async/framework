import path from "node:path";
import process from "node:process";

const isAppsDirectorySpecified = process.argv.length === 3;

const appsDirectory = isAppsDirectorySpecified
  ? path.join(process.cwd(), "..", process.argv[2])
  : path.join(process.cwd(), "..", "apps");

if (isAppsDirectorySpecified) {
  console.log(`Changing working directory to ${process.argv[2]}`);
}

export { appsDirectory };
