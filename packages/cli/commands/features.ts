import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import ora, { Ora } from "ora";

import { createFeature, listFeatures } from "../services/features.js";
import { configStore } from "../stores/config.js";
import { handleError, MissingAppIdError } from "../utils/errors.js";
import { genDTS, genFeatureKey, KeyFormatPatterns } from "../utils/gen.js";
import {
  appIdOption,
  featureKeyOption,
  featureNameArgument,
  typesOutOption,
} from "../utils/options.js";

type CreateFeatureArgs = {
  key?: string;
};

export const createFeatureAction = async (
  name: string | undefined,
  { key }: CreateFeatureArgs,
) => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;
  let existingKeys: string[] = [];

  try {
    if (!appId) throw new MissingAppIdError();
    spinner = ora(
      `Loading features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}...`,
    ).start();
    const features = await listFeatures(appId);
    existingKeys = features.map((f) => f.key);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(appId)} at from ${chalk.cyan(baseUrl)}`,
    );
  } catch (error) {
    spinner?.fail("Loading features failed");
    void handleError(error, "Features Create");
    return;
  }

  try {
    if (!name) {
      name = await input({
        message: "New feature name:",
        validate: (text) => text.length > 0 || "Name is required",
      });
    }

    if (!key) {
      const keyFormat = configStore.getConfig("keyFormat") ?? "custom";
      key = await input({
        message: "New feature key:",
        default: genFeatureKey(name, keyFormat, existingKeys),
        validate: KeyFormatPatterns[keyFormat].validate,
      });
    }

    spinner = ora("Creating feature...").start();
    const feature = await createFeature(appId, name, key);
    spinner.succeed(
      `Created feature ${chalk.cyan(feature.name)} with key ${chalk.cyan(feature.key)}. 🎉`,
    );
  } catch (error) {
    spinner?.fail("Feature creation failed");
    void handleError(error, "Features Create");
  }
};

export const listFeaturesAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  try {
    if (!appId) throw new MissingAppIdError();
    spinner = ora(
      `Loading features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}...`,
    ).start();
    const features = await listFeatures(appId);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}`,
    );
    console.table(features);
  } catch (error) {
    spinner?.fail("Loading features failed");
    void handleError(error, "Features List");
  }
};

export const generateTypesAction = async () => {
  const { baseUrl, appId, typesPath } = configStore.getConfig();
  let spinner: Ora | undefined;
  let featureKeys: string[] = [];
  try {
    if (!appId) throw new MissingAppIdError();
    spinner = ora(
      `Loading features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}...`,
    ).start();
    featureKeys = (await listFeatures(appId)).map(({ key }) => key);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}`,
    );
  } catch (error) {
    spinner?.fail("Loading features failed");
    void handleError(error, "Features Types");
    return;
  }

  try {
    spinner = ora("Generating feature types...").start();
    const types = genDTS(featureKeys);
    const outPath = isAbsolute(typesPath)
      ? typesPath
      : join(configStore.getProjectPath(), typesPath);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, types);
    spinner.succeed("Generated feature types successfully");
    console.log(chalk.green(`Generated types for ${appId}.`));
  } catch (error) {
    spinner?.fail("Type generation failed");
    void handleError(error, "Features Types");
  }
};

export function registerFeatureCommands(cli: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features",
  );

  featuresCommand
    .command("create")
    .description("Create a new feature")
    .addOption(appIdOption)
    .addOption(featureKeyOption)
    .addArgument(featureNameArgument)
    .action(createFeatureAction);

  featuresCommand
    .command("list")
    .description("List all features")
    .addOption(appIdOption)
    .action(listFeaturesAction);

  featuresCommand
    .command("types")
    .description("Generate feature types")
    .addOption(appIdOption)
    .addOption(typesOutOption)
    .action(generateTypesAction);

  // Update the config with the cli override values
  featuresCommand.hook("preAction", (command) => {
    const { appId, out } = command.opts();
    configStore.setConfig({ appId, typesPath: out });
  });

  cli.addCommand(featuresCommand);
}
