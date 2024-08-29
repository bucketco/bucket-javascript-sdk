import chalk from "chalk";
import { Command } from "commander";
import { outputFile } from "fs-extra/esm";

import {
  createFeature,
  genFeatureTypes,
  listFeatures,
  rolloutFeature,
} from "../services/features.js";
import { checkAuth } from "../utils/auth.js";
import { GEN_TYPES_FILE } from "../utils/constants.js";

export const featuresCommand = new Command("features").description(
  "Manage features",
);

featuresCommand
  .command("list")
  .description("List all features")
  .requiredOption("-a, --appId <appId>", "Get all features in app")
  .action(async (options) => {
    checkAuth();
    try {
      const features = await listFeatures(options.appId);
      console.log(chalk.green("Features:"));
      console.table(features);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red("Error fetching features:", error.message));
      }
    }
  });

featuresCommand
  .command("create")
  .description("Create a new feature")
  .action(async () => {
    checkAuth();
    try {
      await createFeature();
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red("Error creating feature:", error.message));
      }
    }
  });

featuresCommand
  .command("types")
  .description("Generate feature types")
  .requiredOption("-a, --appId <appId>", "Get all features in app")
  .action(async (options) => {
    checkAuth();
    try {
      const types = await genFeatureTypes(options.appId);
      await outputFile(GEN_TYPES_FILE, types);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red("Error listing feature types:", error.message));
      }
    }
  });

featuresCommand
  .command("rollout")
  .description("Rollout a feature")
  .action(async () => {
    checkAuth();
    try {
      await rolloutFeature();
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red("Error rolling out feature:", error.message));
      }
    }
  });
