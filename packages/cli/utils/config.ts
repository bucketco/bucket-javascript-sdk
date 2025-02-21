import { readFile, writeFile, mkdir, access } from "fs/promises";
import { dirname } from "path";
import { Ajv } from "ajv";
import JSON5 from "json5";
import { createRequire } from "module";

// https://github.com/nodejs/node/issues/51347#issuecomment-2111337854
const schema = createRequire(import.meta.url)("../../schema.json");

import { CONFIG_FILE_NAME, SCHEMA_URL } from "./constants.js";
import { findUp } from "find-up";

const ajv = new Ajv();
const validateConfig = ajv.compile(schema);

export const keyFormats = [
  "custom",
  "pascalCase",
  "camelCase",
  "snakeCaseUpper",
  "snakeCaseLower",
  "kebabCaseUpper",
  "kebabCaseLower",
] as const;

export type KeyFormat = (typeof keyFormats)[number];

class ConfigValidationError extends Error {
  constructor(errors: typeof validateConfig.errors) {
    const messages = errors
      ?.map((e) => `${e.instancePath} ${e.message}`)
      .join("; ");
    super(`Invalid config: ${messages}`);
    this.name = "ConfigValidationError";
  }
}

type Config = {
  $schema?: string;
  baseUrl?: string;
  apiUrl?: string;
  appId: string;
  typesPath: string;
  keyFormat: KeyFormat;
};

let config: Config = {
  appId: "",
  typesPath: "",
  keyFormat: "custom",
};

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
    const configPath = await findUp(CONFIG_FILE_NAME);
    if (!configPath) {
      return {};
    }
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON5.parse<Config>(content);
    if (!validateConfig(parsed)) {
      throw new ConfigValidationError(validateConfig.errors);
    }
    config = parsed;
    return key ? config[key] : config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

/**
 * Create a new config file with initial values.
 * @param newConfig The configuration object to write
 * @param overwrite If true, overwrites existing config file. Defaults to false
 */
export async function createConfigFile(newConfig: Config, overwrite = false) {
  if (!validateConfig(newConfig)) {
    throw new ConfigValidationError(validateConfig.errors);
  }
  newConfig = { $schema: SCHEMA_URL, ...newConfig };
  try {
    await access(CONFIG_FILE_NAME);
    if (!overwrite) {
      throw new Error("Config file already exists");
    }
    await writeFile(CONFIG_FILE_NAME, JSON.stringify(newConfig, null, 2));
    config = newConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await mkdir(dirname(CONFIG_FILE_NAME), { recursive: true });
      await writeFile(CONFIG_FILE_NAME, JSON.stringify(newConfig, null, 2));
      config = newConfig;
      return;
    }
    throw error;
  }
}
