import chalk from "chalk";
import { Command } from "commander";

import { authenticateUser } from "../utils/auth.js";
import { writeConfigFile } from "../utils/config.js";
import { handleError } from "../utils/error.js";

export function registerAuthCommands(program: Command) {
  const authCommand = new Command("auth").description("Manage authentication");

  authCommand
    .command("login")
    .description("Login to Bucket")
    .requiredOption("-a, --appId <appId>", "Get all features in app")
    .action(async () => {
      try {
        // Initiate the auth process
        await authenticateUser();
        console.log(chalk.green("Logged in successfully!"));
      } catch (error) {
        handleError(error, "Authentication failed:");
      }
    });

  authCommand
    .command("logout")
    .description("Logout from Bucket")
    .action(async () => {
      await writeConfigFile("sessionCookies", undefined);
      console.log(chalk.green("Logged out successfully!"));
    });

  program.addCommand(authCommand);
}
