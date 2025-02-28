#!/usr/bin/env node
import { resolve } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { program } from "commander";

import { registerAppCommands } from "./commands/apps.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerFeatureCommands } from "./commands/features.js";
import { registerInitCommand } from "./commands/init.js";
import { registerNewCommand } from "./commands/new.js";
import { authStore } from "./stores/auth.js";
import { configStore } from "./stores/config.js";
import { apiUrlOption, baseUrlOption, debugOption } from "./utils/options.js";

async function main() {
  // Must load tokens and config before anything else
  await authStore.initialize();
  await configStore.initialize();

  // Global options
  program.addOption(debugOption);
  program.addOption(baseUrlOption);
  program.addOption(apiUrlOption);

  // Pre-action hook
  program.hook("preAction", () => {
    const { debug, baseUrl, apiUrl } = program.opts();
    configStore.setConfig({
      baseUrl,
      apiUrl: apiUrl || (baseUrl && `${baseUrl}/api`),
    });

    if (debug) {
      console.debug(chalk.cyan("\nDebug mode enabled"));
      console.debug(
        "Reading config from",
        chalk.green(configStore.getConfigPath()),
      );
      console.table(configStore.getConfig());
    }
  });

  // Main program
  registerNewCommand(program);
  registerInitCommand(program);
  registerAuthCommands(program);
  registerAppCommands(program);
  registerFeatureCommands(program);

  program.parse(process.argv);
}

// Run the main function if this file is run directly and not imported
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  void main();
}
