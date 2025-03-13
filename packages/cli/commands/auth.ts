import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";

import { authStore } from "../stores/auth.js";
import { configStore } from "../stores/config.js";
import { waitForAccessToken } from "../utils/auth.js";
import { handleError } from "../utils/errors.js";

export const loginAction = async () => {
  const { baseUrl, apiUrl } = configStore.getConfig();

  try {
    await waitForAccessToken(baseUrl, apiUrl);
    console.log(`Logged in to ${chalk.cyan(baseUrl)} successfully! 🎉`);
  } catch (error) {
    console.error("Login failed.");
    void handleError(error, "Login");
  }
};

export const logoutAction = async () => {
  const baseUrl = configStore.getConfig("baseUrl");
  const spinner = ora("Logging out...").start();
  try {
    await authStore.setToken(baseUrl, undefined);
    spinner.succeed("Logged out successfully! 👋");
  } catch (error) {
    spinner.fail("Logout failed.");
    void handleError(error, "Logout");
  }
};

export function registerAuthCommands(cli: Command) {
  cli.command("login").description("Login to Bucket.").action(loginAction);

  cli.command("logout").description("Logout from Bucket.").action(logoutAction);
}
