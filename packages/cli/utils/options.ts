import { Argument, Option } from "commander";

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

export const overwriteOption = new Option(
  "--overwrite",
  "Force initialization and overwrite existing configuration.",
);

export const typesOutOption = new Option(
  "-o, --out [path]",
  `Single output path for generated feature types. Falls back to typesOutput value in ${CONFIG_FILE_NAME}.`,
);

export const typesFormatOption = new Option(
  "-f, --format [format]",
  "Single output format for generated feature types",
).choices(["react", "node"]);

export const featureKeyOption = new Option(
  "-k, --key [feature key]",
  "Feature key. If not provided, a key is generated from the feature's name.",
);

export const featureNameArgument = new Argument("[name]", "Feature's name.");

export const mcpPortOption = new Option(
  "-p, --port [port]",
  "Port for the MCP server to listen on.",
).default(8050);
