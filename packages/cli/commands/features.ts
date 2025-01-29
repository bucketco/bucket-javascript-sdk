import chalk from "chalk";
import { Command } from "commander";

import { input } from "@inquirer/prompts";

import { addFeatureToConfig, genFeatureTypes } from "../services/features.js";

import { handleError } from "../utils/error.js";

import { configFileExists, getConfig, loadConfig } from "../utils/config.js";

export function registerFeaturesCommands(program: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features",
  );

  featuresCommand
    .command("generate")
    .description("Generate feature types")
    .option("--ignore-missing-config", "Ignore missing config")
    .action(async ({ ignoreMissingConfig }) => {
      try {
        if (!(await configFileExists()) && ignoreMissingConfig) return;

        const { features, codeGenBasePath } = await loadConfig();

        genFeatureTypes(features, codeGenBasePath);
        console.log(chalk.green(`Generated typed features.`));
      } catch (error) {
        handleError(error, "Failed to generate feature types:");
      }
    });

  featuresCommand
    .command("add")
    .description("Add a new feature")
    .argument("[key]", "Key for the feature")
    .action(async (key) => {
      await loadConfig();
      try {
        if (key === undefined) {
          key = await input({
            message: "Feature key",
            required: true,
          });
        }
        await addFeatureToConfig({ key, access: true, config: undefined });
        console.log(chalk.green(`Added feature "${key}"`));
      } catch (error) {
        handleError(error, "Failed to create feature:");
      }

      await genFeatureTypes(getConfig().features, getConfig().codeGenBasePath);
    });

  program.addCommand(featuresCommand);
}
