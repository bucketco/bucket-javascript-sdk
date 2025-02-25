import chalk from "chalk";
import { Command, program } from "commander";
import ora from "ora";

import { authenticateUser, setToken } from "../utils/auth.js";
import { handleError } from "../utils/error.js";

export const loginAction = async () => {
  const { baseUrl } = program.opts();
  const spinner = ora(`Logging in to ${chalk.cyan(baseUrl)}...`).start();
  try {
    await authenticateUser();
    spinner.succeed(`Logged in to ${chalk.cyan(baseUrl)} successfully! 🎉`);
  } catch (error) {
    spinner.fail("Login failed");
    handleError(error, "Login");
  }
};

export const logoutAction = async () => {
  const { baseUrl } = program.opts();
  const spinner = ora("Logging out...").start();
  try {
    await setToken(baseUrl, undefined);
    spinner.succeed("Logged out successfully! 👋");
  } catch (error) {
    spinner.fail("Logout failed");
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
