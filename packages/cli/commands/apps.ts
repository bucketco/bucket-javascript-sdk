import { Command, program } from "commander";
import ora from "ora";

import { listApps } from "../services/bootstrap.js";
import { handleError } from "../utils/error.js";
import chalk from "chalk";

export const listAppsAction = async () => {
  const { baseUrl } = program.opts();
  const spinner = ora(`Loading apps from ${chalk.cyan(baseUrl)}...`).start();
  try {
    const apps = await listApps();
    spinner.succeed(`Loaded apps from ${chalk.cyan(baseUrl)}`);
    console.table(apps);
  } catch (error) {
    spinner.fail("Failed to list apps");
    handleError(error, "Apps List");
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
