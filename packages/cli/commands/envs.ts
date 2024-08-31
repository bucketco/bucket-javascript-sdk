import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";

import { listEnvs } from "../services/bootstrap.js";
import { checkAuth } from "../utils/auth.js";
import { getConfig, writeConfigFile } from "../utils/config.js";
import { CONFIG_FILE } from "../utils/constants.js";
import { handleError } from "../utils/error.js";

export function registerEnvsCommands(program: Command) {
  const envsCommand = new Command("envs").description("Manage envs");

  envsCommand
    .command("list")
    .description("List all available environments for the app")
    .requiredOption(
      "-a, --appId <appId>",
      `Get all environments for the app. Falls back to appId stored in ${CONFIG_FILE}.`,
      getConfig("appId"),
    )
    .action(async ({ appId }) => {
      checkAuth();
      try {
        const envs = await listEnvs(appId);
        console.log(chalk.green(`Available environments for app ${appId}:`));
        console.table(envs);
      } catch (error) {
        handleError(error, "Failed to list environment:");
      }
    });

  envsCommand
    .command("select")
    .description("Select environment")
    .requiredOption(
      "-a, --appId <appId>",
      `Get all environments for the app. Falls back to appId stored in ${CONFIG_FILE}.`,
      getConfig("appId"),
    )
    .action(async ({ appId }) => {
      checkAuth();
      try {
        const envs = await listEnvs(appId);

        const answer = await select({
          message: "Select an environment",
          choices: envs.map(({ id, name }) => ({
            name,
            value: id,
          })),
        });

        await writeConfigFile("envId", answer);
      } catch (error) {
        handleError(error, "Failed to select environment:");
      }
    });

  program.addCommand(envsCommand);
}
