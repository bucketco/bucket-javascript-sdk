#!/usr/bin/env node
import { program } from "commander";

import { registerAppsCommands } from "./commands/apps.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerEnvsCommands } from "./commands/envs.js";
import { registerFeaturesCommands } from "./commands/features.js";
import { readConfigFile } from "./utils/config.js";

async function main() {
  // Read the config file
  await readConfigFile();

  // Main program
  registerAuthCommands(program);
  registerAppsCommands(program);
  registerEnvsCommands(program);
  registerFeaturesCommands(program);

  program.parse(process.argv);
}

main();
