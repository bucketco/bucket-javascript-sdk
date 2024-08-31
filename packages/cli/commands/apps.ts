import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";

import { listApps } from "../services/bootstrap.js";
import { checkAuth } from "../utils/auth.js";
import { writeConfigFile } from "../utils/config.js";
import { handleError } from "../utils/error.js";

export function registerAppsCommands(program: Command) {
  const appsCommand = new Command("apps").description("Manage apps");

  appsCommand
    .command("list")
    .description("List all available apps")
    .action(async () => {
      checkAuth();
      try {
        const apps = await listApps();
        console.log(chalk.green("Available apps:"));
        console.table(apps);
      } catch (error) {
        handleError(error, "Failed to list apps:");
      }
    });

  appsCommand
    .command("select")
    .description("Select app")
    .action(async () => {
      checkAuth();
      try {
        const apps = await listApps();

        const answer = await select({
          message: "Select an app",
          choices: apps.map((app) => ({
            name: app.name,
            value: app.id,
            description: app.demo ? "Demo" : undefined,
          })),
        });

        await writeConfigFile("appId", answer);
      } catch (error) {
        handleError(error, "Failed to select app:");
      }
    });

  program.addCommand(appsCommand);
}
