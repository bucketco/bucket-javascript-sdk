import chalk from "chalk";
import { Command } from "commander";

import { handleError } from "../utils/error.js";
import {
  findRepoConfig,
  initConfig,
  writeConfigFile,
} from "../utils/config.js";

export function registerInitCommands(program: Command) {
  program
    .command("init")
    .description("Initialize Bucket for new repository")
    .action(async () => {
      try {
        const configFile = await findRepoConfig();
        if (configFile) {
          console.log(
            chalk.white(`Config file already exists at ${configFile}.`),
          );
          return;
        }

        await writeConfigFile(initConfig, "bucket.config.json");
        chalk.green(`Bucket bucket.config.json written!`);
      } catch (error) {
        handleError(error, "Failed to generate feature types:");
      }
    });
}
