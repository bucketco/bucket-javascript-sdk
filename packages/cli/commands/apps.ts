import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";

import { listApps } from "../services/apps.js";
import { checkAuth } from "../utils/auth.js";
import { writeConfig } from "../utils/config.js";

export const appCommand = new Command("apps").description("Manage apps");

appCommand
  .command("list")
  .description("List all available apps")
  .action(async () => {
    checkAuth();
    try {
      const apps = await listApps();
      console.log(chalk.green("Available apps:"));
      console.table(apps);
    } catch (error) {
      console.error(chalk.red("Error listing apps:", error));
    }
  });

appCommand
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

      await writeConfig("appId", answer);
    } catch (error) {
      console.error(chalk.red("Error listing apps:", error));
    }
  });
