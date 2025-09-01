import { input } from "@inquirer/prompts";
import chalk from "chalk";
import { Command } from "commander";
import { relative } from "node:path";
import ora, { Ora } from "ora";

import { App, getApp, getOrg } from "../services/bootstrap.js";
import { createFlag, Flag, listFlags } from "../services/features.js";
import { configStore } from "../stores/config.js";
import {
  handleError,
  MissingAppIdError,
  MissingEnvIdError,
} from "../utils/errors.js";
import {
  genFlagKey,
  genTypes,
  indentLines,
  KeyFormatPatterns,
  writeTypesToFile,
} from "../utils/gen.js";
import {
  appIdOption,
  flagKeyOption,
  featureNameArgument,
  typesFormatOption,
  typesOutOption,
} from "../utils/options.js";
import { baseUrlSuffix, featureUrl } from "../utils/urls.js";

type CreateFlagOptions = {
  key?: string;
};

export const createFlagAction = async (
  name: string | undefined,
  { key }: CreateFlagOptions,
) => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    handleError(new MissingAppIdError(), "Flags Create");
  }

  let app: App;
  try {
    app = getApp(appId);
  } catch (error) {
    handleError(error, "Flags Create");
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
      const keyFormat = org.flagKeyFormat;
      const keyValidator = KeyFormatPatterns[keyFormat];
      key = await input({
        message: "New feature key:",
        default: genFlagKey(name, keyFormat),
        validate: (str) => keyValidator.regex.test(str) || keyValidator.message,
      });
    }

    spinner = ora(`Creating feature...`).start();
    const feature = await createFlag(appId, { name, key });

    spinner.succeed(
      `Created feature ${chalk.cyan(feature.name)} with key ${chalk.cyan(feature.key)}:`,
    );
    if (production) {
      console.log(
        indentLines(chalk.magenta(featureUrl(baseUrl, production, feature))),
      );
    }
  } catch (error) {
    spinner?.fail("Flag creation failed.");
    handleError(error, "Flags Create");
  }
};

export const listFlagsAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  let spinner: Ora | undefined;

  if (!appId) {
    handleError(new MissingAppIdError(), "Flags Create");
  }

  try {
    const app = getApp(appId);
    const production = app.environments.find((e) => e.isProduction);
    if (!production) {
      handleError(new MissingEnvIdError(), "Flags Types");
    }

    spinner = ora(
      `Loading features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();

    const featuresResponse = await listFlags(appId, {
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
    handleError(error, "Flags List");
  }
};

export const generateTypesAction = async () => {
  const { baseUrl, appId } = configStore.getConfig();
  const typesOutput = configStore.getConfig("typesOutput");

  let spinner: Ora | undefined;
  let features: Flag[] = [];

  if (!appId) {
    handleError(new MissingAppIdError(), "Flags Types");
  }

  let app: App;
  try {
    app = getApp(appId);
  } catch (error) {
    handleError(error, "Flags Types");
  }

  const production = app.environments.find((e) => e.isProduction);
  if (!production) {
    handleError(new MissingEnvIdError(), "Flags Types");
  }

  try {
    spinner = ora(
      `Loading features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}...`,
    ).start();

    features = await listFlags(appId, {
      envId: production.id,
      includeRemoteConfigs: true,
    }).then((res) => res.data);

    spinner.succeed(
      `Loaded features of app ${chalk.cyan(app.name)}${baseUrlSuffix(baseUrl)}.`,
    );
  } catch (error) {
    spinner?.fail("Loading features failed.");
    handleError(error, "Flags Types");
  }

  try {
    spinner = ora(`Generating feature types...`).start();
    const projectPath = configStore.getProjectPath();

    // Generate types for each output configuration
    for (const output of typesOutput) {
      const types = genTypes(features, output.format);

      const outPath = await writeTypesToFile(types, output.path, projectPath);
      spinner.succeed(
        `Generated ${output.format} types in ${chalk.cyan(relative(projectPath, outPath))}.`,
      );
    }
  } catch (error) {
    spinner?.fail("Type generation failed.");
    handleError(error, "Flags Types");
  }
};

export function registerFlagCommands(cli: Command) {
  const featuresCommand = new Command("flags").description(
    "Manage features.",
  );

  featuresCommand
    .command("create")
    .description("Create a new feature.")
    .addOption(appIdOption)
    .addOption(flagKeyOption)
    .addArgument(featureNameArgument)
    .action(createFlagAction);

  featuresCommand
    .command("list")
    .alias("ls")
    .description("List all features.")
    .addOption(appIdOption)
    .action(listFlagsAction);

  featuresCommand
    .command("types")
    .description("Generate feature types.")
    .addOption(appIdOption)
    .addOption(typesOutOption)
    .addOption(typesFormatOption)
    .action(generateTypesAction);

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
