import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { authenticateUser } from "../utils/auth.js";
import { writeConfigFile } from "../utils/config.js";
import { handleError } from "../utils/error.js";

export function registerAuthCommands(program: Command) {
  const authCommand = new Command("auth").description("Manage authentication");

  authCommand
    .command("login")
    .description("Login to Bucket")
    .action(async () => {
      const spinner = ora("Logging in...").start();
      try {
        // Initiate the auth process
        await authenticateUser();
        spinner.succeed();
        console.log(chalk.green("Logged in successfully!"));
      } catch (error) {
        spinner.fail();
        handleError(error, "Authentication failed:");
      }
    });

  authCommand
    .command("logout")
    .description("Logout from Bucket")
    .action(async () => {
      const spinner = ora("Logging out...").start();
      try {
        await writeConfigFile("sessionCookies", undefined);
        spinner.succeed();
        console.log(chalk.green("Logged out successfully!"));
      } catch (error) {
        spinner.fail();
        handleError(error, "Logout failed:");
      }
    });

  program.addCommand(authCommand);
}
