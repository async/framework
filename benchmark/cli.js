// @ts-check
import { program } from "commander";

import { cleanFrameworkDirectories } from "./cli/cleanup.js";
import { rebuildAllFrameworks } from "./cli/rebuild-all-frameworks.js";
import { rebuildFrameworks } from "./cli/rebuild-build-single.js";

program
  .command("cleanup")
  .description("Clean app directories of package-lock.json, yarn-lock, node_modules, and dist output")
  .option("--apps-dir-path [string]", "", "apps")
  .action((options) => {
    cleanFrameworkDirectories(options);
  });

program
  .command("build-all")
  .option("--ci [boolean]", "", false)
  .option("--restart-with-app [string]", "", "")
  .action((options) => {
    rebuildAllFrameworks({ restartWithApp: options.restartWithApp, useCi: options.ci });
  });

program
  .command("build-apps")
  .option("-f, --apps [apps...]", "", [])
  .option("--ci [boolean]", "", false)
  .action((options) => {
    if (!rebuildFrameworks(options.apps, options.ci)) {
      process.exit(1);
    }
  });

program.parse();
