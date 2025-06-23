import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { Argument, Command } from "commander";
import { relative } from "node:path";
import ora, { Ora } from "ora";

import { App, getApp, getOrg } from "../services/bootstrap.js";
import {
  createFeature,
  Feature,
  listFeatures,
  updateFeatureAccess,
} from "../services/features.js";
import { configStore } from "../stores/config.js";
import {
  handleError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import {
  genFeatureKey,
  genTypes,
  indentLines,
  KeyFormatPatterns,
  writeTypesToFile,
} from "../utils/gen.js";
import {
  appIdOption,
  companyIdsOption,
  disableFeatureOption,
  enableFeatureOption,
  featureKeyOption,
  featureNameArgument,
  segmentIdsOption,
  typesFormatOption,
  typesOutOption,
  userIdsOption,
} from "../utils/options.js";
import { baseUrlSuffix, featureUrl } from "../utils/urls.js";

const lf = new Intl.ListFormat("en");

type CreateFeatureArgs = {
  key?: string;
};

export const createFeatureAction = async (
  name: string | undefined,
  { key }: CreateFeatureArgs,
) => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    return handleError(new MissingAppIdError(), "Features Create");
  }

  let app: App;
  try {
    app = getApp(appId);
  } catch (error) {
    return handleError(error, "Features Create");
  }

  const production = app.environments.find((e) => e.isProduction);

  try {
    const org = getOrg();
    console.log(
      `Creating feature for app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
    if (!name) {
      name = await input({
        message: "New feature name:",
        validate: (text) => text.length > 0 || "Name is required.",
      });
    }

    if (!key) {
      const keyFormat = org.featureKeyFormat;
      const keyValidator = KeyFormatPatterns[keyFormat];
      key = await input({
        message: "New feature key:",
        default: genFeatureKey(name, keyFormat),
        validate: (str) => keyValidator.regex.test(str) || keyValidator.message,
      });
    }

    spinner = ora(`Creating feature...`).start();
    const feature = await createFeature(appId, { name, key });
    spinner.succeed(
      `Created feature ${chalk.cyan(feature.name)} with key ${chalk.cyan(feature.key)}:`,
    );
    if (production) {
      console.log(
        indentLines(chalk.magenta(featureUrl(baseUrl, production, feature))),
      );
    }
  } catch (error) {
    spinner?.fail("Feature creation failed.");
    void handleError(error, "Features Create");
  }
};

export const listFeaturesAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    return handleError(new MissingAppIdError(), "Features Create");
  }

  try {
    const app = getApp(appId);
    const production = app.environments.find((e) => e.isProduction);
    if (!production) {
      return handleError(new MissingEnvIdError(), "Features Types");
    }
    spinner = ora(
      `Loading features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();
    const featuresResponse = await listFeatures(appId, {
      envId: production.id,
    });
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
    console.table(
      featuresResponse.data.map(({ key, name, stage }) => ({
        name,
        key,
        stage: stage?.name,
      })),
    );
  } catch (error) {
    spinner?.fail("Loading features failed.");
    void handleError(error, "Features List");
  }
};

export const generateTypesAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  const typesOutput = configStore.getConfig("typesOutput");

  let spinner: Ora | undefined;
  let features: Feature[] = [];

  if (!appId) {
    return handleError(new MissingAppIdError(), "Features Types");
  }

  let app: App;
  try {
    app = getApp(appId);
  } catch (error) {
    return handleError(error, "Features Types");
  }

  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    return handleError(new MissingEnvIdError(), "Features Types");
  }

  try {
    spinner = ora(
      `Loading features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();
    features = await listFeatures(appId, {
      envId: production.id,
      includeRemoteConfigs: true,
    }).then((res) => res.data);
    spinner.succeed(
      `Loaded features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
  } catch (error) {
    spinner?.fail("Loading features failed.");
    return handleError(error, "Features Types");
  }

  try {
    spinner = ora("Generating feature types...").start();
    const projectPath = configStore.getProjectPath();

    // Generate types for each output configuration
    for (const output of typesOutput) {
      const types = await genTypes(features, output.format);
      const outPath = await writeTypesToFile(types, output.path, projectPath);
      spinner.succeed(
        `Generated ${output.format} types in ${chalk.cyan(relative(projectPath, outPath))}.`,
      );
    }

    spinner.succeed(`Generated types for app ${chalk.cyan(app.name)}.`);
  } catch (error) {
    spinner?.fail("Type generation failed.");
    void handleError(error, "Features Types");
  }
};

export const featureAccessAction = async (
  featureKey: string | undefined,
  options: {
    enable: boolean;
    disable: boolean;
    companies?: string[];
    segments?: string[];
    users?: string[];
  },
) => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    return handleError(new MissingAppIdError(), "Feature Access");
  }

  let app: App;
  try {
    app = getApp(appId);
  } catch (error) {
    return handleError(error, "Features Types");
  }

  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    return handleError(new MissingEnvIdError(), "Feature Access");
  }

  // Validate conflicting options
  if (options.enable && options.disable) {
    return handleError(
      "Cannot both enable and disable a feature.",
      "Feature Access",
    );
  }

  if (!options.enable && !options.disable) {
    return handleError(
      "Must specify either --enable or --disable.",
      "Feature Access",
    );
  }

  // Validate at least one target is specified
  if (
    !options.companies?.length &&
    !options.segments?.length &&
    !options.users?.length
  ) {
    return handleError(
      "Must specify at least one target using --companies, --segments, or --users.",
      "Feature Access",
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
        return handleError("No features found for this app.", "Feature Access");
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
      return handleError(error, "Feature Access");
    }
  }

  // Determine if enabling or disabling
  const isEnabled = options.enable;

  const targets = [
    ...(options.users?.map((id) => chalk.cyan(`user ID ${id}`)) ?? []),
    ...(options.companies?.map((id) => chalk.cyan(`company ID ${id}`)) ?? []),
    ...(options.segments?.map((id) => chalk.cyan(`segment ID ${id}`)) ?? []),
  ];

  try {
    spinner = ora(
      `${isEnabled ? "Enabling" : "Disabling"} feature ${chalk.cyan(featureKey)} for ${lf.format(targets)}...`,
    ).start();

    await updateFeatureAccess(appId, {
      envId: production.id,
      featureKey,
      isEnabled,
      companyIds: options.companies,
      segmentIds: options.segments,
      userIds: options.users,
    });

    spinner.succeed(
      `${isEnabled ? "Enabled" : "Disabled"} feature ${chalk.cyan(featureKey)} for specified ${lf.format(targets)}.`,
    );
  } catch (error) {
    spinner?.fail(`Feature access update failed.`);
    void handleError(error, "Feature Access");
  }
};

export function registerFeatureCommands(cli: Command) {
  const featuresCommand = new Command("features").description(
    "Manage features.",
  );

  featuresCommand
    .command("create")
    .description("Create a new feature.")
    .addOption(appIdOption)
    .addOption(featureKeyOption)
    .addArgument(featureNameArgument)
    .action(createFeatureAction);

  featuresCommand
    .command("list")
    .alias("ls")
    .description("List all features.")
    .addOption(appIdOption)
    .action(listFeaturesAction);

  featuresCommand
    .command("types")
    .description("Generate feature types.")
    .addOption(appIdOption)
    .addOption(typesOutOption)
    .addOption(typesFormatOption)
    .action(generateTypesAction);

  // Add feature access command
  featuresCommand
    .command("access")
    .description(
      "Grant or revoke feature access for companies, segments, and users.",
    )
    .addOption(appIdOption)
    .addArgument(
      new Argument(
        "[featureKey]",
        "Feature key. If not provided, you'll be prompted to select one",
      ),
    )
    .addOption(enableFeatureOption)
    .addOption(disableFeatureOption)
    .addOption(companyIdsOption)
    .addOption(segmentIdsOption)
    .addOption(userIdsOption)
    .action(featureAccessAction);

  // Update the config with the cli override values
  featuresCommand.hook("preAction", (_, command) => {
    const { appId, out, format } = command.opts();
    configStore.setConfig({
      appId,
      typesOutput: out ? [{ path: out, format: format || "react" }] : undefined,
    });
  });

  cli.addCommand(featuresCommand);
}
