import { Argument, Option } from "commander";

import { keyFormats } from "../stores/config.js";

import { CONFIG_FILE_NAME } from "./constants.js";

export const debugOption = new Option("--debug", "Enable debug mode");

export const baseUrlOption = new Option(
  "--base-url [url]",
  `Bucket service URL (useful if behind a proxy). Falls back to baseUrl value in ${CONFIG_FILE_NAME}.`,
);

export const apiUrlOption = new Option(
  "--api-url [url]",
  `Bucket API URL (useful if behind a proxy). Falls back to apiUrl value in ${CONFIG_FILE_NAME} or baseUrl with /api appended.`,
);

export const appIdOption = new Option(
  "-a, --appId [appId]",
  `Bucket App ID. Falls back to appId value in ${CONFIG_FILE_NAME}.`,
);

export const initOverrideOption = new Option(
  "-f, --force",
  "Force initialization and overwrite existing configuration.",
);

export const typesOutOption = new Option(
  "-o, --out [path]",
  `Output path for generated feature types. Falls back to typesPath value in ${CONFIG_FILE_NAME}.`,
);

export const keyFormatOption = new Option(
  "--key-format [format]",
  `Feature key format. Falls back to keyFormat value in ${CONFIG_FILE_NAME}.`,
).choices(keyFormats);

export const featureKeyOption = new Option(
  "-k, --key [feature key]",
  "Feature key. If not provided, a key is generated from the feature's name.",
);

export const featureNameArgument = new Argument("[name]", "Feature's name.");
