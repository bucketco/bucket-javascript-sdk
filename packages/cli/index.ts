#!/usr/bin/env node
import { program } from "commander";

import { appCommand } from "./commands/apps.js";
import { authCommand } from "./commands/auth.js";
import { featuresCommand } from "./commands/features.js";
import { loadSessionCookie } from "./utils/auth.js";

async function main() {
  // Main program
  program
    .addCommand(authCommand)
    .addCommand(appCommand)
    .addCommand(featuresCommand);

  // Load the access token before parsing arguments
  await loadSessionCookie();

  program.parse(process.argv);
}

main();
