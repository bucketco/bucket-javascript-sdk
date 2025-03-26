import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { Argument, Command } from "commander";
import ora, { Ora } from "ora";

import { getApp } from "../services/bootstrap.js";
import {
  CompanyFeatureAccess,
  companyFeatureAccess,
  listCompanies,
} from "../services/companies.js";
import { listFeatures } from "../services/features.js";
import { configStore } from "../stores/config.js";
import {
  handleError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import {
  appIdOption,
  companyFilterOption,
  companyIdArgument,
  disableFeatureOption,
  enableFeatureOption,
} from "../utils/options.js";
import { baseUrlSuffix } from "../utils/path.js";

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

export const companyFeatureAccessAction = async (
  companyId: string,
  featureKey: string | undefined,
  options: { enable: boolean; disable: boolean },
) => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    return handleError(new MissingAppIdError(), "Company Feature Access");
  }

  const app = getApp(appId);
  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    return handleError(new MissingEnvIdError(), "Company Feature Access");
  }

  // Validate conflicting options
  if (options.enable && options.disable) {
    return handleError(
      "Cannot both enable and disable a feature.",
      "Company Feature Access",
    );
  }

  if (!options.enable && !options.disable) {
    return handleError(
      "Must specify either --enable or --disable.",
      "Company Feature Access",
    );
  }

  // If feature key is not provided, let user select one
  if (!featureKey) {
    try {
      spinner = ora(
        `Loading features for app ${chalk.cyan(app.name)}${baseUrlSuffix(
          baseUrl,
        )}...`,
      ).start();

      const featuresResponse = await listFeatures(appId, {
        envId: production.id,
      });

      if (featuresResponse.data.length === 0) {
        return handleError(
          "No features found for this app.",
          "Company Feature Access",
        );
      }

      spinner.succeed(
        `Loaded features for app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
      );

      featureKey = await select({
        message: "Select a feature to manage access:",
        choices: featuresResponse.data.map((feature) => ({
          name: `${feature.name} (${feature.key})`,
          value: feature.key,
        })),
      });
    } catch (error) {
      spinner?.fail("Loading features failed.");
      return handleError(error, "Company Feature Access");
    }
  }

  // Determine if enabling or disabling
  const isEnabled = options.enable;

  try {
    spinner = ora(
      `${isEnabled ? "Enabling" : "Disabling"} feature ${chalk.cyan(featureKey)} for company ${chalk.cyan(companyId)}...`,
    ).start();

    const request: CompanyFeatureAccess = {
      envId: production.id,
      companyId,
      featureKey,
      isEnabled,
    };

    await companyFeatureAccess(appId, request);

    spinner.succeed(
      `${isEnabled ? "Enabled" : "Disabled"} feature ${chalk.cyan(featureKey)} for company ${chalk.cyan(companyId)}.`,
    );
  } catch (error) {
    spinner?.fail(`Feature access update failed.`);
    void handleError(error, "Company Feature Access");
  }
};

export function registerCompanyCommands(cli: Command) {
  const companiesCommand = new Command("companies").description(
    "Manage companies.",
  );

  const companyFeaturesCommand = new Command("features").description(
    "Manage company features.",
  );

  companiesCommand
    .command("list")
    .description("List all companies.")
    .addOption(appIdOption)
    .addOption(companyFilterOption)
    .action(listCompaniesAction);

  // Feature access command
  companyFeaturesCommand
    .command("access")
    .description("Grant or revoke feature access for a specific company.")
    .addOption(appIdOption)
    .addArgument(companyIdArgument)
    .addArgument(
      new Argument(
        "[featureKey]",
        "Feature key. If not provided, you'll be prompted to select one",
      ),
    )
    .addOption(enableFeatureOption)
    .addOption(disableFeatureOption)
    .action(companyFeatureAccessAction);

  companiesCommand.addCommand(companyFeaturesCommand);

  // Update the config with the cli override values
  companiesCommand.hook("preAction", (_, command) => {
    const { appId } = command.opts();
    configStore.setConfig({
      appId,
    });
  });

  cli.addCommand(companiesCommand);
}
