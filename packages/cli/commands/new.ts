import { Command } from "commander";
import { findUp } from "find-up";

import { configStore } from "../stores/config.js";
import { CONFIG_FILE_NAME } from "../utils/constants.js";
import {
  appIdOption,
  featureKeyOption,
  featureNameArgument,
  keyFormatOption,
  typesFormatOption,
  typesOutOption,
} from "../utils/options.js";

import { createFeatureAction, generateTypesAction } from "./features.js";
import { initAction } from "./init.js";

type NewArgs = {
  appId?: string;
  out: string;
  key?: string;
};

export const newAction = async (name: string | undefined, { key }: NewArgs) => {
  if (!(await findUp(CONFIG_FILE_NAME))) {
    await initAction();
  }
  await createFeatureAction(name, {
    key,
  });
  await generateTypesAction();
};

export function registerNewCommand(cli: Command) {
  cli
    .command("new")
    .description(
      "Initialize the Bucket CLI, authenticates, and creates a new feature",
    )
    .addOption(appIdOption)
    .addOption(keyFormatOption)
    .addOption(typesOutOption)
    .addOption(typesFormatOption)
    .addOption(featureKeyOption)
    .addArgument(featureNameArgument)
    .action(newAction);

  // Update the config with the cli override values
  cli.hook("preAction", (command) => {
    const { appId, keyFormat, out, format } = command.opts();
    configStore.setConfig({
      appId,
      keyFormat,
      typesOutput: out ? [{ path: out, format: format || "react" }] : undefined,
    });
  });
}
