import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { Command, program } from "commander";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import ora, { Ora } from "ora";

import { createFeature, listFeatures } from "../services/features.js";
import { getConfig, getProjectPath } from "../utils/config.js";
import { handleError } from "../utils/error.js";
import { genDTS, genFeatureKey, KeyFormatPatterns } from "../utils/gen.js";
import { options } from "../utils/options.js";

type AppIdArgs = {
  appId: string;
};

type CreateFeatureArgs = AppIdArgs & {
  key?: string;
};

type GenerateTypesArgs = AppIdArgs & {
  out: string;
};

export const createFeatureAction = async (
  name: string | undefined,
  { appId, key }: CreateFeatureArgs,
) => {
  const { baseUrl } = program.opts();
  let spinner: Ora | undefined;
  let existingKeys: string[] = [];
  try {
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
    handleError(error, "Features Create");
  }

  try {
    if (!name) {
      name = await input({
        message: "New feature name:",
        validate: (input) => input.length > 0 || "Name is required",
      });
    }

    if (!key) {
      const keyFormat = getConfig("keyFormat") ?? "custom";
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
    handleError(error, "Features Create");
  }
};

export const listFeaturesAction = async ({ appId }: AppIdArgs) => {
  const { baseUrl } = program.opts();
  const spinner = ora(
    `Loading features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}...`,
  ).start();
  try {
    const features = await listFeatures(appId);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}`,
    );
    console.table(features);
  } catch (error) {
    spinner.fail("Loading features failed");
    handleError(error, "Features List");
  }
};

export const generateTypesAction = async ({
  appId,
  out,
}: GenerateTypesArgs) => {
  const { baseUrl } = program.opts();
  let spinner: Ora | undefined;
  let featureKeys: string[] = [];
  try {
    spinner = ora(
      `Loading features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}...`,
    ).start();
    featureKeys = (await listFeatures(appId)).map(({ key }) => key);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(appId)} at ${chalk.cyan(baseUrl)}`,
    );
  } catch (error) {
    spinner?.fail("Loading features failed");
    handleError(error, "Features Types");
  }

  try {
    spinner = ora("Generating feature types...").start();
    const types = genDTS(featureKeys);
    const outPath = isAbsolute(out) ? out : join(getProjectPath(), out);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, types);
    spinner.succeed("Generated feature types successfully");
    console.log(chalk.green(`Generated types for ${appId}.`));
  } catch (error) {
    spinner?.fail("Type generation failed");
    handleError(error, "Features Types");
  }
};

export function registerFeatureCommands(program: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features",
  );

  featuresCommand
    .command("create")
    .description("Create a new feature")
    .requiredOption(
      options.appId.flags,
      options.appId.description,
      getConfig(options.appId.configKey),
    )
    .option(options.featureKey.flags, options.featureKey.description)
    .argument(options.featureName.flags, options.featureName.description)
    .action(createFeatureAction);

  featuresCommand
    .command("list")
    .description("List all features")
    .requiredOption(
      options.appId.flags,
      options.appId.description,
      getConfig(options.appId.configKey),
    )
    .action(listFeaturesAction);

  featuresCommand
    .command("types")
    .description("Generate feature types")
    .requiredOption(
      options.appId.flags,
      options.appId.description,
      getConfig(options.appId.configKey),
    )
    .requiredOption(
      options.typesOut.flags,
      options.typesOut.description,
      getConfig(options.typesOut.configKey) ?? options.typesOut.fallback,
    )
    .action(generateTypesAction);

  program.addCommand(featuresCommand);
}
