import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { authenticateUser, storeToken } from "../utils/auth.js";
import { handleError } from "../utils/error.js";

export const loginAction = async () => {
  const spinner = ora("Logging in...").start();
  try {
    await authenticateUser();
    spinner.succeed();
    console.log(chalk.green("Logged in successfully!"));
  } catch (error) {
    spinner.fail();
    handleError(error, "Authentication failed:");
  }
};

export const logoutAction = async () => {
  const spinner = ora("Logging out...").start();
  try {
    await storeToken("");
    spinner.succeed();
    console.log(chalk.green("Logged out successfully!"));
  } catch (error) {
    spinner.fail();
    handleError(error, "Logout failed:");
  }
};

export function registerAuthCommands(program: Command) {
  program.command("login").description("Login to Bucket").action(loginAction);

  program
    .command("logout")
    .description("Logout from Bucket")
    .action(logoutAction);
}
