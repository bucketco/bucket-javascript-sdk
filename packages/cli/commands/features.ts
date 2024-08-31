import chalk from "chalk";
import { Command } from "commander";
import { outputFile } from "fs-extra/esm";
import ora from "ora";

import {
  createFeature,
  genFeatureTypes,
  listFeatures,
} from "../services/features.js";
import { checkAuth } from "../utils/auth.js";
import { getConfig } from "../utils/config.js";
import { CONFIG_FILE, GEN_TYPES_FILE } from "../utils/constants.js";
import { handleError } from "../utils/error.js";

export function registerFeaturesCommands(program: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features",
  );

  featuresCommand
    .command("list")
    .description("List all features")
    .requiredOption(
      "-a, --appId <appId>",
      `Get all features in the app. Falls back to appId stored in ${CONFIG_FILE}.`,
      getConfig("appId"),
    )
    .action(async ({ appId }) => {
      const spinner = ora("Loading features...").start();
      checkAuth();
      try {
        const features = await listFeatures(appId);
        spinner.succeed();
        console.log(chalk.green(`Features in ${appId}:`));
        console.table(features);
      } catch (error) {
        spinner.fail();
        handleError(error, "Failed to list features:");
      }
    });

  featuresCommand
    .command("types")
    .description("Generate feature types")
    .requiredOption(
      "-a, --appId <appId>",
      `Generate types for features in the app. Falls back to appId stored in ${CONFIG_FILE}.`,
      getConfig("appId"),
    )
    .option(
      "-o, --out <path>",
      `Generate types for features at the output path. Falls back to ${GEN_TYPES_FILE}.`,
      GEN_TYPES_FILE,
    )
    .action(async ({ appId, out }) => {
      const spinner = ora("Generating feature types...").start();
      checkAuth();
      try {
        const types = await genFeatureTypes(appId);
        await outputFile(out, types);
        spinner.succeed();
        console.log(chalk.green(`Generated features for ${appId}.`));
      } catch (error) {
        spinner.fail();
        handleError(error, "Failed to generate feature types:");
      }
    });

  featuresCommand
    .command("create")
    .description("Create a new feature")
    .argument("<name>", "Name of the feature")
    .requiredOption(
      "-a, --appId <appId>",
      `Get all features in the app. Falls back to appId stored in ${CONFIG_FILE}.`,
      getConfig("appId"),
    )
    .requiredOption(
      "-e, --envId <envId>",
      `Get all features in the env. Falls back to envId stored in ${CONFIG_FILE}.`,
      getConfig("envId"),
    )
    .option(
      "-k, --key <feature key>",
      `Create a feature in the app with the given feature key. Falls back to a slug of the feature name.`,
    )
    .action(async (name, { appId, envId, key }) => {
      const spinner = ora("Creating feature...").start();
      checkAuth();
      try {
        const feature = await createFeature(appId, envId, name, key);
        spinner.succeed();
        console.log(
          chalk.green(
            `Created feature ${feature.name} with key ${feature.key}.`,
          ),
        );
      } catch (error) {
        spinner.fail();
        handleError(error, "Failed to create feature:");
      }
    });

  program.addCommand(featuresCommand);
}
