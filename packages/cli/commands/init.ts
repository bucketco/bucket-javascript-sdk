import chalk from "chalk";
import { Command } from "commander";

import { handleError } from "../utils/error.js";
import { findRepoConfig, writeConfigFile } from "../utils/config.js";

function trySDK(packageName: string) {
  try {
    require.resolve(packageName);
    return true;
  } catch (error) {
    return false;
  }
}

function detectSDK() {
  if (trySDK("@bucketco/react-sdk")) {
    return "react";
  }

  if (trySDK("@bucketco/node-sdk")) {
    return "node";
  }

  return "browser";
}

export function registerInitCommands(program: Command) {
  program
    .command("init")
    .description("Initialize Bucket for new repository")
    .option("-s, --sdk <sdk>", "SDK to generate types for")
    .action(async ({ sdk }) => {
      try {
        const configFile = await findRepoConfig();
        if (configFile) {
          console.log(
            chalk.white(`Config file already exists at ${configFile}.`),
          );
          return;
        }

        const sdkType = sdk ?? detectSDK();

        await writeConfigFile(
          {
            features: [],
            sdk: sdkType,
          },
          "bucket.config.json",
        );
        chalk.green(`Bucket config initialized!`);
      } catch (error) {
        handleError(error, "Failed to generate feature types:");
      }
    });
}
