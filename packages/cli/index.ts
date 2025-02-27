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
import { loadTokenFile } from "./utils/auth.js";
import { getConfig, getConfigPath, loadConfigFile } from "./utils/config.js";
import { options } from "./utils/options.js";

async function main() {
  // Must load tokens and config before anything else
  await loadTokenFile();
  await loadConfigFile();

  // Global options
  program.option(options.debug.flags, options.debug.description, false);
  program.requiredOption(
    options.baseUrl.flags,
    options.baseUrl.description,
    getConfig(options.baseUrl.configKey) ?? options.baseUrl.fallback,
  );
  program.option(
    options.apiUrl.flags,
    options.apiUrl.description,
    getConfig(options.apiUrl.configKey),
  );

  // Pre-action hook
  program.hook("preAction", () => {
    const { debug } = program.opts();
    if (debug) {
      console.debug(chalk.cyan("\nDebug mode enabled"));
      console.debug("Reading config from", chalk.green(getConfigPath()));
      console.table(getConfig());
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
