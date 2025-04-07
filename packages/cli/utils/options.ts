import { Argument, Option } from "commander";

import { CONFIG_FILE_NAME } from "./constants.js";

export const debugOption = new Option("--debug", "Enable debug mode.");

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

export const featureNameArgument = new Argument(
  "[name]",
  "Feature's name. If not provided, you'll be prompted to enter one.",
);

export const featureKeyOption = new Option(
  "-k, --key [feature key]",
  "Feature key. If not provided, a key is generated from the feature's name.",
);

export const mcpSsePortOption = new Option(
  "-p, --port [port]",
  "Port for the MCP server to listen on when using SSE transport with the --sse flag.",
).default(8050);

export const companyFilterOption = new Option(
  "-f, --filter [name]",
  "Filter companies by name or ID.",
);

export const companyIdArgument = new Argument("<companyId>", "Company ID");
export const featureKeyArgument = new Argument(
  "[featureKey]",
  "Feature key. If not provided, you'll be prompted to select one.",
);

export const enableFeatureOption = new Option(
  "--enable",
  "Enable the feature for the target.",
).conflicts("disable");

export const disableFeatureOption = new Option(
  "--disable",
  "Disable the feature for the target.",
).conflicts("enable");

export const userIdsOption = new Option(
  "--users <ids...>",
  "User IDs to target. Can be specified multiple times.",
);

export const companyIdsOption = new Option(
  "--companies <ids...>",
  "Company IDs to target. Can be specified multiple times.",
);

export const segmentIdsOption = new Option(
  "--segments <ids...>",
  "Segment IDs to target. Can be specified multiple times.",
);

export const rulesFormatOption = new Option(
  "-f, --format [format]",
  "Format to copy rules in",
)
  .choices(["cursor", "copilot"])
  .default("cursor");

export const yesOption = new Option(
  "-y, --yes",
  "Skip confirmation prompts and overwrite existing files without asking.",
);
