#!/usr/bin/env node
import chalk from "chalk";
import { program } from "commander";
import { join } from "node:path";

import { registerAppCommands } from "./commands/apps.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerFeatureCommands } from "./commands/features.js";
import { registerInitCommand } from "./commands/init.js";
import { registerNewCommand } from "./commands/new.js";
import { authStore } from "./stores/auth.js";
import { configStore } from "./stores/config.js";
import { apiUrlOption, baseUrlOption, debugOption } from "./utils/options.js";
import { stripTrailingSlash } from "./utils/path.js";

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
    const cleanedBaseUrl = stripTrailingSlash(baseUrl?.trim());
    configStore.setConfig({
      baseUrl: cleanedBaseUrl,
      apiUrl:
        stripTrailingSlash(apiUrl) ||
        (cleanedBaseUrl && `${cleanedBaseUrl}/api`),
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
if (
  process.argv[1].endsWith(join("cli", "dist", "index.js")) ||
  process.argv[1].endsWith(join(".bin", "bucket"))
) {
  void main();
}
