#!/usr/bin/env node
import { program } from "commander";

import { registerFeaturesCommands } from "./commands/features.js";
import { registerInitCommands } from "./commands/init.js";

async function main() {
  // Main program
  registerFeaturesCommands(program);
  registerInitCommands(program);

  program.parse(process.argv);
}

main();
