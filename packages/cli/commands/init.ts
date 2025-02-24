import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, program } from "commander";
import ora, { Ora } from "ora";

import { listApps } from "../services/bootstrap.js";
import { createConfig, getConfigPath } from "../utils/config.js";

import { chalkBrand, DEFAULT_TYPES_PATH } from "../utils/constants.js";
import { handleError } from "../utils/error.js";
import { options } from "../utils/options.js";

type InitArgs = {
  force?: boolean;
};

export const initAction = async (args: InitArgs) => {
  let spinner: Ora | undefined;

  try {
    // Check if already initialized
    const configPath = getConfigPath();
    if (configPath) {
      if (!args.force) {
        throw new Error(
          "Bucket is already initialized. Use --force to overwrite.",
        );
      }
    }

    console.log(chalkBrand("\nWelcome to Bucket! 🪣\n"));
    const { baseUrl, apiUrl } = program.opts();

    // Load apps
    spinner = ora(`Loading apps from ${chalk.cyan(baseUrl)}...`).start();
    const apps = await listApps();
    spinner.succeed(`Loaded apps from ${chalk.cyan(baseUrl)}`);

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
    await createConfig(
      {
        baseUrl,
        apiUrl,
        appId,
        typesPath,
        keyFormat,
      },
      args.force,
    );
    spinner.succeed(`Configuration created at ${getConfigPath()}! 🎉`);
  } catch (error) {
    spinner?.fail();
    handleError(error, "Initialization");
  }
};

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new Bucket configuration")
    .option(options.initOverride.flags, options.initOverride.description)
    .action(initAction);
}
