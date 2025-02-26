import { Command } from "commander";
import { findUp } from "find-up";

import { getConfig } from "../utils/config.js";
import { CONFIG_FILE_NAME } from "../utils/constants.js";
import { handleError } from "../utils/error.js";
import { options } from "../utils/options.js";

import { createFeatureAction, generateTypesAction } from "./features.js";
import { initAction } from "./init.js";

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
    void handleError(error, "New");
  }
};

export function registerNewCommand(cli: Command) {
  cli
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
