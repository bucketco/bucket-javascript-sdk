import chalk from "chalk";
import { Command } from "commander";

import {
  authenticateUser,
  removeSessionCookie,
  saveSessionCookie,
} from "../utils/auth.js";

export const authCommand = new Command("auth").description(
  "Manage authentication",
);

authCommand
  .command("login")
  .description("Login to Bucket")
  .action(async () => {
    try {
      // Initiate the auth process
      const cookies = await authenticateUser();
      await saveSessionCookie(cookies);
      console.log(chalk.green("Logged in successfully."));
    } catch (error) {
      console.error(chalk.red("Authentication failed."), error);
    }
  });

authCommand
  .command("logout")
  .description("Logout from Bucket")
  .action(() => {
    removeSessionCookie();
    console.log(chalk.green("Logged out successfully."));
  });
