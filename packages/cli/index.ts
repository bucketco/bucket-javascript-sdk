#!/usr/bin/env node
import chalk from "chalk";
import { program } from "commander";
import ora from "ora";

import { registerAppCommands } from "./commands/apps.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerCompanyCommands } from "./commands/companies.js";
import { registerFeatureCommands } from "./commands/features.js";
import { registerInitCommand } from "./commands/init.js";
import { registerMcpCommand } from "./commands/mcp.js";
import { registerNewCommand } from "./commands/new.js";
import { bootstrap, getUser } from "./services/bootstrap.js";
import { authStore } from "./stores/auth.js";
import { configStore } from "./stores/config.js";
import { handleError } from "./utils/errors.js";
import { apiUrlOption, baseUrlOption, debugOption } from "./utils/options.js";
import { stripTrailingSlash } from "./utils/path.js";

type Options = {
  debug?: boolean;
  baseUrl?: string;
  apiUrl?: string;
};

async function main() {
  // Must load tokens and config before anything else
  await authStore.initialize();
  await configStore.initialize();

  // Global options
  program.addOption(debugOption);
  program.addOption(baseUrlOption);
  program.addOption(apiUrlOption);

  // Pre-action hook
  program.hook("preAction", async () => {
    const { debug, baseUrl, apiUrl } = program.opts<Options>();
    const cleanedBaseUrl = stripTrailingSlash(baseUrl?.trim());
    // Set baseUrl and apiUrl in config store, will skip if undefined
    configStore.setConfig({
      baseUrl: cleanedBaseUrl,
      apiUrl:
        stripTrailingSlash(apiUrl) ||
        (cleanedBaseUrl && `${cleanedBaseUrl}/api`),
    });

    const spinner = ora("Bootstrapping...").start();
    try {
      // Load bootstrap data if not already loaded
      await bootstrap();
      spinner.stop();
    } catch (error) {
      spinner.fail("Bootstrap failed.");
      void handleError(
        debug ? error : `Unable to reach ${configStore.getConfig("baseUrl")}.`,
        "Connect",
      );
    }

    if (debug) {
      console.debug(chalk.cyan("\nDebug mode enabled."));
      const user = getUser();
      console.debug(`Logged in as ${chalk.cyan(user.name ?? user.email)}.`);
      console.debug(
        "Reading config from:",
        chalk.cyan(configStore.getConfigPath()),
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
  registerCompanyCommands(program);
  registerMcpCommand(program);

  program.parse(process.argv);
}

void main();
