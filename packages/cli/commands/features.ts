import chalk from "chalk";
import { Command } from "commander";

import { input } from "@inquirer/prompts";

import {
  addFeatureToConfig,
  generatePackagedConfig,
} from "../services/features.js";

import { handleError } from "../utils/error.js";

import {
  configFileExists,
  FallbackValue,
  getConfig,
  loadConfig,
} from "../utils/config.js";

type FeaturesEvaluatedResponse =
  | {
      success: true;
      features: {
        [key: string]: {
          isEnabled: boolean;
          key: string;
          config: any;
        };
      };
    }
  | { success: false; error?: string };

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

        generatePackagedConfig(features, codeGenBasePath);
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
        await addFeatureToConfig({ key, access: true, configType: undefined });
        console.log(chalk.green(`Added feature "${key}"`));
      } catch (error) {
        handleError(error, "Failed to create feature:");
      }

      await generatePackagedConfig(
        getConfig().features,
        getConfig().codeGenBasePath,
      );
    });

  featuresCommand
    .command("sync")
    .description("Synchronize features with the server")
    .option("--no-fallbacks", "Do not config with fallback values the server")
    .action(async () => {
      await loadConfig();

      if (!process.env.BUCKET_SECRET_KEY) {
        handleError(
          new Error("No BUCKET_SECRET_KEY found in environment"),
          "Failed to synchronize features",
        );
      }

      let response: FeaturesEvaluatedResponse;
      try {
        const httpResponse = await fetch(
          "https://front.bucket.co/features/evaluate",
          {
            headers: {
              Authorization: "Bearer " + process.env.BUCKET_SECRET_KEY,
            },
          },
        );
        if (!httpResponse.ok) {
          throw new Error(
            "Fetching features returned unexpected response: " +
              httpResponse.body,
          );
        }
        response = await httpResponse.json();
      } catch (e) {
        handleError(e, "Failed to fetch features");
      }

      if (!response.success) {
        throw new Error(
          "Fetching features failed: " + JSON.stringify(response),
        );
      }

      const fallbackValues: {
        [key: string]: {
          isEnabled: boolean;
          config: any;
        };
      } = {};

      for (const localFeature of getConfig().features) {
        const remoteFeature = response.features[localFeature.key];
        if (!remoteFeature) {
          console.log(
            chalk.yellow(
              `Feature "${localFeature}" not found on server. Click here to create it: https://app.bucket.co/envs/current/features/new?key=${localFeature}`,
            ),
          );
        } else {
          fallbackValues[localFeature.key] = {
            isEnabled: remoteFeature.isEnabled,
            config: remoteFeature.config,
          } as FallbackValue;
        }
      }

      await generatePackagedConfig(
        getConfig().features,
        getConfig().codeGenBasePath,
      );
    });

  program.addCommand(featuresCommand);
}
