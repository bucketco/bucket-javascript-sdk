import { readJson, writeJson } from "fs-extra/esm";

import { CONFIG_FILE } from "./constants.js";

type Config = {
  token?: string;
  appId?: string;
  envId?: string;
};

let config: Config = {};

/**
 * Instantly return a specified key's value or the entire config object.
 */
export function getConfig(): Config;
export function getConfig(key: keyof Config): string | undefined;
export function getConfig(key?: keyof Config) {
  return key ? config[key] : config;
}

/**
 * Read the config file and return either a specified key's value or the entire config object.
 */
export async function readConfigFile(): Promise<Config>;
export async function readConfigFile(
  key: keyof Config,
): Promise<string | undefined>;
export async function readConfigFile(key?: keyof Config) {
  try {
    config = await readJson(CONFIG_FILE);
    return key ? config[key] : config;
  } catch (error) {
    return {};
  }
}

/**
 * Write a new value to the config file.
 */
export async function writeConfigFile(
  key: keyof Config,
  value: string | undefined,
) {
  const config = await readConfigFile();
  config[key] = value;
  await writeJson(CONFIG_FILE, config);
}
