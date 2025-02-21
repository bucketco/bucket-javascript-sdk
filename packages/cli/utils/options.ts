import { Option } from "commander";
import { getConfig } from "./config.js";
import { CONFIG_FILE_NAME } from "./constants.js";

export const appIdOption = new Option(
  "-a, --appId <appId>",
  `Get all features in the app. Falls back to appId stored in ${CONFIG_FILE_NAME}.`,
)
  .default(getConfig("appId"), "Bucket Application ID")
  .makeOptionMandatory();
