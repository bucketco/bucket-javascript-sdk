import {
  CONFIG_FILE_NAME,
  DEFAULT_BASE_URL,
  DEFAULT_TYPES_PATH,
} from "./constants.js";

export const options = {
  debug: {
    flags: "--debug",
    description: "Enable debug mode",
  },
  baseUrl: {
    flags: "--base-url [url]",
    description: "Specify the Bucket service URL (useful if behind a proxy).",
    configKey: "baseUrl",
    fallback: DEFAULT_BASE_URL,
  },
  apiUrl: {
    flags: "--api-url [url]",
    description: `Specify the Bucket API URL (useful if behind a proxy). Falls back to apiUrl value in ${CONFIG_FILE_NAME} or baseUrl with /api appended.`,
    configKey: "apiUrl",
  },
  appId: {
    flags: "-a, --appId <appId>",
    description: `Specify the app ID. Falls back to appId value in ${CONFIG_FILE_NAME}.`,
    configKey: "appId",
  },
  initOverride: {
    flags: "-f, --force",
    description: "Force initialization and overwrite existing configuration.",
  },
  typesOut: {
    flags: "-o, --out [path]",
    description: `Specify the output path for generated feature types. Falls back to typesPath value in ${CONFIG_FILE_NAME} or ${DEFAULT_TYPES_PATH}`,
    configKey: "typesPath",
    fallback: DEFAULT_TYPES_PATH,
  },
  featureName: {
    flags: "[name]",
    description: "Specify the feature's name.",
  },
  featureKey: {
    flags: "-k, --key [feature key]",
    description:
      "Specify the feature key. If not provided, a key is generated from the feature's name.",
  },
} as const;
