import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { listApps } from "../services/bootstrap.js";
import { handleError } from "../utils/error.js";

export const listAppsAction = async () => {
  const spinner = ora("Loading apps...").start();
  try {
    const apps = await listApps();
    spinner.succeed();
    console.log(chalk.green("Available apps:"));
    console.table(apps);
  } catch (error) {
    spinner.fail();
    handleError(error, "Failed to list apps:");
  }
};

export function registerAppCommands(program: Command) {
  const appsCommand = new Command("apps").description("Manage apps");

  appsCommand
    .command("list")
    .description("List all available apps")
    .action(listAppsAction);

  program.addCommand(appsCommand);
}
