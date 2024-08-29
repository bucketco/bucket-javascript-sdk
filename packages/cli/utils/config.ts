import { readJson, writeJson } from "fs-extra/esm";

import { CONFIG_FILE } from "./constants.js";

/**
 * Read a value from the config file.
 */
export async function readConfig(key?: string) {
  try {
    const config = await readJson(CONFIG_FILE);
    return key ? config[key] : config;
  } catch (error) {
    return {};
  }
}

/**
 * Write a new value to the config file.
 */
export async function writeConfig(key: string, value: string) {
  const config = await readConfig();
  config[key] = value;
  await writeJson(CONFIG_FILE, config);
}
