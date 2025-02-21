import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, program } from "commander";
import ora from "ora";

import { listApps } from "../services/bootstrap.js";
import { createConfigFile } from "../utils/config.js";

import { DEFAULT_TYPES_PATH } from "../utils/constants.js";
import { handleError } from "../utils/error.js";

type InitArgs = {
  force?: boolean;
};

export const initAction = async (args: InitArgs) => {
  console.log(chalk.magenta("\nWelcome to Bucket! 🪣\n"));
  const { baseUrl, apiUrl } = program.opts();

  try {
    // Check if already authenticated
    let spinner = ora(`Authenticating with ${baseUrl}...`).start();
    const apps = await listApps();
    spinner.succeed("Authenticated");

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
    spinner.succeed("Configuration created");

    console.log(chalk.green("\nBucket initialized successfully! 🎉"));
    console.log(
      chalk.gray(
        "\nNext steps:\n1. Run 'bucket features sync' to sync your feature flags\n2. Import the generated types in your code",
      ),
    );
  } catch (error) {
    handleError(error, "Initialization failed:");
  }
};

export function registerInitCommand(program: Command) {
  program
    .command("init")
    .description("Initialize a new Bucket configuration")
    .option(
      "-f, --force",
      "Force initialization overwriting existing configuration",
    )
    .action(initAction);
}
