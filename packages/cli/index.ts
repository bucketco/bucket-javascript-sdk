#!/usr/bin/env node --no-warnings=ExperimentalWarning
import chalk from "chalk";
import { program } from "commander";

import { registerAppCommands } from "./commands/apps.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerFeatureCommands } from "./commands/features.js";
import { registerInitCommand } from "./commands/init.js";
import { registerNewCommand } from "./commands/new.js";
import { loadTokens } from "./utils/auth.js";
import { getConfig, getConfigPath, loadConfig } from "./utils/config.js";
import { options } from "./utils/options.js";

async function main() {
  // Must load tokens and config before anything else
  await loadTokens();
  await loadConfig();

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

void main();
