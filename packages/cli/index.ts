#!/usr/bin/env node --no-warnings=ExperimentalWarning
import { program } from "commander";

import { registerAuthCommands } from "./commands/auth.js";
import { registerFeatureCommands } from "./commands/features.js";
import { registerInitCommand } from "./commands/init.js";
import { getConfig, readConfigFile } from "./utils/config.js";
import { registerAppCommands } from "./commands/apps.js";
import chalk from "chalk";
import { DEFAULT_API_URL, DEFAULT_BASE_URL } from "./utils/constants.js";

async function main() {
  // Read the config file
  const config = await readConfigFile();

  // Global options
  program.option("--debug", "Enable debug mode", false);
  program.requiredOption(
    "--base-url [url]",
    "Specify the Bucket base url",
    getConfig("baseUrl") ?? DEFAULT_BASE_URL,
  );
  program.option(
    "--api-url [url]",
    "Specify the Bucket API url",
    getConfig("apiUrl") ?? DEFAULT_API_URL,
  );

  // Pre-action hook
  program.hook("preAction", () => {
    const { debug } = program.opts();
    if (debug) {
      console.debug(chalk.cyan("\nDebug mode enabled"));
      console.table(config);
    }
  });

  // Main program
  registerInitCommand(program);
  registerAuthCommands(program);
  registerAppCommands(program);
  registerFeatureCommands(program);

  program.parse(process.argv);
}

main();
