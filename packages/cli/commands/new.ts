import { Command } from "commander";
import { findUp } from "find-up";
import { CONFIG_FILE_NAME } from "../utils/constants.js";
import { initAction } from "./init.js";
import { createFeatureAction, generateTypesAction } from "./features.js";
import { handleError } from "../utils/error.js";
import { getConfig } from "../utils/config.js";
import { options } from "../utils/options.js";

type NewArgs = {
  appId?: string;
  out: string;
  key?: string;
};

export const newAction = async (
  name: string | undefined,
  { appId, out, key }: NewArgs,
) => {
  try {
    if (!(await findUp(CONFIG_FILE_NAME))) {
      await initAction({});
    }
    appId = appId ?? getConfig("appId");
    if (!appId) {
      throw new Error(
        "App ID is required. Please provide it with --appId or in the config file.",
      );
    }
    await createFeatureAction(name, {
      appId,
      key,
    });
    await generateTypesAction({
      appId,
      out,
    });
  } catch (error) {
    handleError(error, "New");
  }
};

export function registerNewCommand(program: Command) {
  program
    .command("new")
    .description(
      "Initialize the Bucket CLI, authenticates, and creates a new feature",
    )
    .option(
      options.appId.flags,
      options.appId.description,
      getConfig(options.appId.configKey),
    )
    .option(
      options.typesOut.flags,
      options.typesOut.description,
      getConfig(options.typesOut.configKey) ?? options.typesOut.fallback,
    )
    .option(options.featureKey.flags, options.featureKey.description)
    .argument(options.featureName.flags, options.featureName.description)
    .action(newAction);
}
