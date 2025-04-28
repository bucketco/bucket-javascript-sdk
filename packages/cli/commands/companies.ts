import chalk from "chalk";
import { Command } from "commander";
import ora, { Ora } from "ora";

import { getApp } from "../services/bootstrap.js";
import { listCompanies } from "../services/companies.js";
import { configStore } from "../stores/config.js";
import {
  handleError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import { appIdOption, companyFilterOption } from "../utils/options.js";
import { baseUrlSuffix } from "../utils/urls.js";

export const listCompaniesAction = async (options: { filter?: string }) => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    return handleError(new MissingAppIdError(), "Companies List");
  }
  const app = getApp(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    return handleError(new MissingEnvIdError(), "Companies List");
  }

  try {
    spinner = ora(
      `Loading companies for app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();

    const companiesResponse = await listCompanies(appId, {
      envId: production.id,
      // Use the filter for name/ID filtering if provided
      idNameFilter: options.filter,
    });

    spinner.succeed(
      `Loaded companies for app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );

    console.table(
      companiesResponse.data.map(({ id, name, userCount, lastSeen }) => ({
        id,
        name: name || "(unnamed)",
        users: userCount,
        lastSeen: lastSeen ? new Date(lastSeen).toLocaleDateString() : "Never",
      })),
    );

    console.log(`Total companies: ${companiesResponse.totalCount}`);
  } catch (error) {
    spinner?.fail("Loading companies failed.");
    void handleError(error, "Companies List");
  }
};

export function registerCompanyCommands(cli: Command) {
  const companiesCommand = new Command("companies").description(
    "Manage companies.",
  );

  companiesCommand
    .command("list")
    .alias("ls")
    .description("List all companies.")
    .addOption(appIdOption)
    .addOption(companyFilterOption)
    .action(listCompaniesAction);

  // Update the config with the cli override values
  companiesCommand.hook("preAction", (_, command) => {
    const { appId } = command.opts();
    configStore.setConfig({
      appId,
    });
  });

  cli.addCommand(companiesCommand);
}
