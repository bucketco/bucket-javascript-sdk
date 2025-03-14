import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";
import ora, { Ora } from "ora";

import { App, getApp, getOrg } from "../services/bootstrap.js";
import { createFeature, Feature, listFeatures } from "../services/features.js";
import { configStore } from "../stores/config.js";
import { handleError, MissingAppIdError } from "../utils/errors.js";
import {
  genFeatureKey,
  genTypes,
  indentLines,
  KeyFormatPatterns,
} from "../utils/gen.js";
import {
  appIdOption,
  featureKeyOption,
  featureNameArgument,
  typesFormatOption,
  typesOutOption,
} from "../utils/options.js";
import { baseUrlSuffix, featureUrl } from "../utils/path.js";

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
    const org = getOrg();
    const app = getApp(appId);
    console.log(
      `Creating feature for app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
    if (!name) {
      name = await input({
        message: "New feature name:",
        validate: (text) => text.length > 0 || "Name is required.",
      });
    }

    if (!key) {
      const keyFormat = org.featureKeyFormat;
      key = await input({
        message: "New feature key:",
        default: genFeatureKey(name, keyFormat),
        validate: KeyFormatPatterns[keyFormat].validate,
      });
    }

    spinner = ora(`Creating feature...`).start();
    const feature = await createFeature(appId, name, key);
    spinner.succeed(
      `Created feature ${chalk.cyan(feature.name)} with key ${chalk.cyan(feature.key)}:`,
    );
    const production = app.environments.find((e) => e.isProduction);
    if (production) {
      console.log(
        indentLines(chalk.magenta(featureUrl(baseUrl, production, feature))),
      );
    }
  } catch (error) {
    spinner?.fail("Feature creation failed.");
    void handleError(error, "Features Create");
  }
};

export const listFeaturesAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  try {
    if (!appId) throw new MissingAppIdError();
    const app = getApp(appId);
    spinner = ora(
      `Loading features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();
    const features = await listFeatures(appId);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
    console.table(
      features.map(({ key, name, stage }) => ({
        name,
        key,
        stage: stage?.name,
      })),
    );
  } catch (error) {
    spinner?.fail("Loading features failed.");
    void handleError(error, "Features List");
  }
};

export const generateTypesAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  const typesOutput = configStore.getConfig("typesOutput");

  let spinner: Ora | undefined;
  let features: Feature[] = [];
  let app: App | undefined;
  try {
    if (!appId) throw new MissingAppIdError();
    app = getApp(appId);
    spinner = ora(
      `Loading features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();
    features = await listFeatures(appId, {
      includeRemoteConfigs: true,
    });
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
  } catch (error) {
    spinner?.fail("Loading features failed.");
    void handleError(error, "Features Types");
    return;
  }

  try {
    spinner = ora("Generating feature types...").start();
    const projectPath = configStore.getProjectPath();

    // Generate types for each output configuration
    for (const output of typesOutput) {
      const types = await genTypes(features, output.format);
      const outPath = isAbsolute(output.path)
        ? output.path
        : join(projectPath, output.path);

      await mkdir(dirname(outPath), { recursive: true });
      await writeFile(outPath, types);
      spinner.succeed(
        `Generated ${output.format} types in ${chalk.cyan(relative(projectPath, outPath))}.`,
      );
    }

    spinner.succeed(`Generated types for app ${chalk.cyan(app.name)}.`);
  } catch (error) {
    spinner?.fail("Type generation failed.");
    void handleError(error, "Features Types");
  }
};

export function registerFeatureCommands(cli: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features.",
  );

  featuresCommand
    .command("create")
    .description("Create a new feature.")
    .addOption(appIdOption)
    .addOption(featureKeyOption)
    .addArgument(featureNameArgument)
    .action(createFeatureAction);

  featuresCommand
    .command("list")
    .description("List all features.")
    .addOption(appIdOption)
    .action(listFeaturesAction);

  featuresCommand
    .command("types")
    .description("Generate feature types.")
    .addOption(appIdOption)
    .addOption(typesOutOption)
    .addOption(typesFormatOption)
    .action(generateTypesAction);

  // Update the config with the cli override values
  featuresCommand.hook("preAction", (_, command) => {
    const { appId, out, format } = command.opts();
    configStore.setConfig({
      appId,
      typesOutput: out ? [{ path: out, format: format || "react" }] : undefined,
    });
  });

  cli.addCommand(featuresCommand);
}
