import chalk from "chalk";
import { Command } from "commander";
import { outputFile } from "fs-extra/esm";
import ora from "ora";

import {
  createFeature,
  genFeatureTypes,
  listFeatures,
} from "../services/features.js";
import { getConfig } from "../utils/config.js";
import {
  CONFIG_FILE_NAME,
  DEFAULT_TYPES_PATH as DEFAULT_TYPES_PATH,
} from "../utils/constants.js";
import { handleError } from "../utils/error.js";
import { appIdOption } from "../utils/options.js";

type AppIdArgs = {
  appId: string;
};

export const listFeaturesAction = async ({ appId }: AppIdArgs) => {
  const spinner = ora("Loading features...").start();
  try {
    const features = await listFeatures(appId);
    spinner.succeed();
    console.log(chalk.green(`Features in ${appId}:`));
    console.table(features);
  } catch (error) {
    spinner.fail();
    handleError(error, "Failed to list features:");
  }
};

type GenerateTypesArgs = AppIdArgs & {
  out: string;
};

export const generateTypesAction = async ({
  appId,
  out,
}: GenerateTypesArgs) => {
  const spinner = ora("Generating feature types...").start();
  try {
    const types = await genFeatureTypes(appId);
    await outputFile(out, types);
    spinner.succeed();
    console.log(chalk.green(`Generated features for ${appId}.`));
  } catch (error) {
    spinner.fail();
    handleError(error, "Failed to generate feature types:");
  }
};

type CreateFeatureArgs = AppIdArgs & {
  key?: string;
};

export const createFeatureAction = async (
  name: string,
  { appId, key }: CreateFeatureArgs,
) => {
  const spinner = ora("Creating feature...").start();
  try {
    const feature = await createFeature(appId, name, key);
    spinner.succeed();
    console.log(
      chalk.green(`Created feature ${feature.name} with key ${feature.key}.`),
    );
  } catch (error) {
    spinner.fail();
    handleError(error, "Failed to create feature:");
  }
};

export function registerFeatureCommands(program: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features",
  );

  featuresCommand
    .command("list")
    .description("List all features")
    .addOption(appIdOption)
    .action(listFeaturesAction);

  featuresCommand
    .command("types")
    .description("Generate feature types")
    .addOption(appIdOption)
    .option(
      "-o, --out <path>",
      `Generate types for features at the output path. Falls back to typePath stored in ${CONFIG_FILE_NAME} or ${DEFAULT_TYPES_PATH}.`,
      getConfig("typesPath") ?? DEFAULT_TYPES_PATH,
    )
    .action(generateTypesAction);

  featuresCommand
    .command("create")
    .description("Create a new feature")
    .argument("<name>", "Name of the feature")
    .addOption(appIdOption)
    .option(
      "-k, --key <feature key>",
      `Create a feature in the app with the given feature key. Falls back to a slug of the feature name.`,
    )
    .action(createFeatureAction);

  program.addCommand(featuresCommand);
}
