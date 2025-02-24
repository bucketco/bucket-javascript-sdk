import { Command, program } from "commander";
import ora from "ora";
import chalk from "chalk";

import { authenticateUser, storeToken } from "../utils/auth.js";
import { handleError } from "../utils/error.js";

export const loginAction = async () => {
  const { baseUrl } = program.opts();
  const spinner = ora(`Logging in to ${chalk.cyan(baseUrl)}...`).start();
  try {
    await authenticateUser();
    spinner.succeed(`Logged in to ${chalk.cyan(baseUrl)} successfully! 🎉`);
  } catch (error) {
    spinner.fail();
    handleError(error, "Login");
  }
};

export const logoutAction = async () => {
  const spinner = ora("Logging out...").start();
  try {
    await storeToken("");
    spinner.succeed("Logged out successfully! 👋");
  } catch (error) {
    spinner.fail();
    handleError(error, "Logout");
  }
};

export function registerAuthCommands(program: Command) {
  program.command("login").description("Login to Bucket").action(loginAction);

  program
    .command("logout")
    .description("Logout from Bucket")
    .action(logoutAction);
}
