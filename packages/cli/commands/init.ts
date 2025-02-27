import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, program } from "commander";
import { relative } from "node:path";
import ora, { Ora } from "ora";

import { App, listApps } from "../services/bootstrap.js";
import { createConfigFile, getConfigPath } from "../utils/config.js";
import { chalkBrand, DEFAULT_TYPES_PATH } from "../utils/constants.js";
import { handleError } from "../utils/error.js";
import { options } from "../utils/options.js";

type InitArgs = {
  force?: boolean;
};

export const initAction = async (args: InitArgs) => {
  let spinner: Ora | undefined;
  let apps: App[] = [];

  try {
    // Check if already initialized
    const configPath = getConfigPath();
    if (configPath && !args.force) {
      throw new Error(
        "Bucket is already initialized. Use --force to overwrite.",
      );
    }

    console.log(chalkBrand("\nWelcome to Bucket! 🪣\n"));
    const { baseUrl } = program.opts();

    // Load apps
    spinner = ora(`Loading apps from ${chalk.cyan(baseUrl)}...`).start();
    apps = await listApps();
    spinner.succeed(`Loaded apps from ${chalk.cyan(baseUrl)}`);
  } catch (error) {
    spinner?.fail("Loading apps failed");
    void handleError(error, "Initialization");
  }

  try {
    const { baseUrl, apiUrl } = program.opts();
    let appId: string | undefined;
    const nonDemoApps = apps.filter((app) => !app.demo);

    // If there is only one non-demo app, select it automatically
    if (nonDemoApps.length === 1) {
      appId = nonDemoApps[0].id;
      console.log(
        chalk.gray(
          `Automatically selected app ${nonDemoApps[0].name} (${appId})`,
        ),
      );
    } else {
      appId = await select({
        message: "Select an app",
        choices: apps.map((app) => ({
          name: app.name,
          value: app.id,
          description: app.demo ? "Demo" : undefined,
        })),
      });
    }

    const keyFormat =
      apps.find((app) => app.id === appId)?.featureKeyFormat ?? "custom";

    // Get types output path
    const typesPath = await input({
      message: "Where should we generate the types?",
      default: DEFAULT_TYPES_PATH,
    });

    // Create config file
    spinner = ora("Creating configuration...").start();
    await createConfigFile(
      {
        baseUrl,
        apiUrl,
        appId,
        typesPath,
        keyFormat,
      },
      args.force,
    );
    spinner.succeed(
      `Configuration created at ${chalk.cyan(relative(process.cwd(), getConfigPath()!))}`,
    );
  } catch (error) {
    spinner?.fail("Configuration creation failed");
    void handleError(error, "Initialization");
  }
};

export function registerInitCommand(cli: Command) {
  cli
    .command("init")
    .description("Initialize a new Bucket configuration")
    .option(options.initOverride.flags, options.initOverride.description)
    .action(initAction);
}
