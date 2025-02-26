import { readFile, writeFile } from "fs/promises";
import { createRequire } from "module";
import { dirname, join } from "path";
import { Ajv } from "ajv";
import { findUp } from "find-up";
import JSON5 from "json5";

import {
  CONFIG_FILE_NAME,
  DEFAULT_API_URL,
  DEFAULT_BASE_URL,
  DEFAULT_TYPES_PATH,
  SCHEMA_URL,
} from "./constants.js";
import { handleError } from "./error.js";

// https://github.com/nodejs/node/issues/51347#issuecomment-2111337854
const schema = createRequire(import.meta.url)("../../schema.json");

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
      ?.map((e) => {
        const path = e.instancePath || "config";
        const value = e.params?.allowedValues
          ? `: ${e.params.allowedValues.join(", ")}`
          : "";
        return `${path}: ${e.message}${value}`;
      })
      .join("\n");
    super(messages);
    this.name = "ConfigValidationError";
  }
}

type Config = {
  $schema?: string;
  baseUrl?: string;
  apiUrl?: string;
  appId: string;
  typesPath?: string;
  keyFormat?: KeyFormat;
};

let config: Config | undefined;
let configPath: string | undefined;
let projectPath: string | undefined;

/**
 * Instantly return a specified key's value or the entire config object.
 */
export function getConfig(): Config | undefined;
export function getConfig<K extends keyof Config>(
  key: K,
): Config[K] | undefined;
export function getConfig<K extends keyof Config>(key?: K) {
  return key ? config?.[key] : config;
}

/**
 * Return the path to the config file.
 */
export function getConfigPath() {
  return configPath;
}

/**
 * Return the path to the project root.
 */
export function getProjectPath() {
  return projectPath ?? process.cwd();
}

/**
 * Load the configuration file.
 */
export async function loadConfig() {
  try {
    const packageJSONPath = await findUp("package.json");
    configPath = await findUp(CONFIG_FILE_NAME);
    projectPath = dirname(configPath ?? packageJSONPath ?? process.cwd());
    if (!configPath) return;
    const content = await readFile(configPath, "utf-8");
    const parsed = JSON5.parse<Config>(content);
    if (!validateConfig(parsed)) {
      void handleError(
        new ConfigValidationError(validateConfig.errors),
        "Config",
      );
    }
    config = parsed;
  } catch {
    // No config file found
  }
}

/**
 * Create a new config file with initial values.
 * @param newConfig The configuration object to write
 * @param overwrite If true, overwrites existing config file. Defaults to false
 */
const getDefaultConfig = (): Partial<Config> => ({
  baseUrl: DEFAULT_BASE_URL,
  apiUrl: DEFAULT_API_URL,
  typesPath: DEFAULT_TYPES_PATH,
  keyFormat: "custom",
});

export async function saveConfig(newConfig: Config, overwrite = false) {
  if (!validateConfig(newConfig)) {
    void handleError(
      new ConfigValidationError(validateConfig.errors),
      "Config",
    );
  }

  const defaults = getDefaultConfig();
  const configWithoutDefaults: Config = {
    $schema: SCHEMA_URL,
    appId: newConfig.appId,
  };

  // Only include non-default values
  Object.entries(newConfig).forEach(([key, value]) => {
    if (key === "$schema") return; // Using our own schema URL
    if (key === "appId") return; // Already included
    if (value !== defaults[key as keyof typeof defaults]) {
      (configWithoutDefaults as any)[key] = value;
    }
  });

  const configJSON = JSON.stringify(configWithoutDefaults, null, 2);

  if (configPath) {
    if (!overwrite) {
      throw new Error("Config file already exists");
    }
    await writeFile(configPath, configJSON);
    config = newConfig;
  } else {
    // Write to the nearest package.json directory
    configPath = join(getProjectPath(), CONFIG_FILE_NAME);
    await writeFile(configPath, configJSON);
    config = newConfig;
  }
}
