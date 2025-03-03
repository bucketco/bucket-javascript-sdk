import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import ora, { Ora } from "ora";

import { createFeature, listFeatures } from "../services/features.js";
import { configStore } from "../stores/config.js";
import { handleError, MissingAppIdError } from "../utils/errors.js";
import { genDTS, genFeatureKey, KeyFormatPatterns } from "../utils/gen.js";
import {
  appIdOption,
  featureKeyOption,
  featureNameArgument,
  keyFormatOption,
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
  try {
    if (!appId) throw new MissingAppIdError();
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
        default: genFeatureKey(name, keyFormat),
        validate: KeyFormatPatterns[keyFormat].validate,
      });
    }

    spinner = ora(
      `Creating feature for app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}...`,
    ).start();
    const feature = await createFeature(appId, name, key);
    // todo: would like to link to feature here but we don't have the env id, only app id
    spinner.succeed(
      `Created feature ${chalk.cyan(feature.name)} with key ${chalk.cyan(feature.key)} at ${chalk.cyan(baseUrl)}. 🎉`,
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
  const { baseUrl, appId, typesOutput } = configStore.getConfig();

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
    const projectPath = configStore.getProjectPath();
    const outPath = isAbsolute(typesOutput)
      ? typesOutput
      : join(projectPath, typesOutput);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, types);
    spinner.succeed(
      `Generated types for ${chalk.cyan(appId)} in ${chalk.cyan(relative(projectPath, outPath))}.`,
    );
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
    .addOption(keyFormatOption)
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
  featuresCommand.hook("preAction", (_, command) => {
    const { appId, keyFormat, out } = command.opts();
    configStore.setConfig({ appId, keyFormat, typesOutput: out });
  });

  cli.addCommand(featuresCommand);
}
