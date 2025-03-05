import { Ajv, ValidateFunction } from "ajv";
import { findUp } from "find-up";
import JSON5 from "json5";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CONFIG_FILE_NAME,
  DEFAULT_API_URL,
  DEFAULT_BASE_URL,
  DEFAULT_TYPES_OUTPUT,
  SCHEMA_URL,
} from "../utils/constants.js";
import { ConfigValidationError, handleError } from "../utils/errors.js";
import { stripTrailingSlash } from "../utils/path.js";

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

type Config = {
  $schema: string;
  baseUrl: string;
  apiUrl: string;
  appId: string | undefined;
  typesOutput: string;
  keyFormat: KeyFormat;
};

const defaultConfig: Config = {
  $schema: SCHEMA_URL,
  baseUrl: DEFAULT_BASE_URL,
  apiUrl: DEFAULT_API_URL,
  appId: undefined,
  typesOutput: DEFAULT_TYPES_OUTPUT,
  keyFormat: "custom",
};

class ConfigStore {
  protected config: Config = { ...defaultConfig };
  protected configPath: string | undefined;
  protected projectPath: string | undefined;
  protected validateConfig: ValidateFunction | undefined;

  async initialize() {
    await this.createValidator();
    await this.loadConfigFile();
  }

  protected async createValidator() {
    try {
      // Using current config store file, resolve the schema.json path
      const filePath = fileURLToPath(import.meta.url);
      const schemaPath = join(
        filePath.substring(0, filePath.indexOf("cli") + 3),
        "schema.json",
      );
      const content = await readFile(schemaPath, "utf-8");
      const parsed = JSON5.parse<Config>(content);
      const ajv = new Ajv();
      this.validateConfig = ajv.compile(parsed);
    } catch {
      void handleError(new Error("Failed to load the config schema"), "Config");
    }
  }

  protected async loadConfigFile() {
    if (!this.validateConfig) {
      void handleError(new Error("Failed to load the config schema"), "Config");
      return;
    }

    try {
      const packageJSONPath = await findUp("package.json");
      this.configPath = await findUp(CONFIG_FILE_NAME);
      this.projectPath = dirname(
        this.configPath ?? packageJSONPath ?? process.cwd(),
      );

      if (!this.configPath) return;

      const content = await readFile(this.configPath, "utf-8");
      const parsed = JSON5.parse<Partial<Config>>(content);
      parsed.baseUrl = stripTrailingSlash(parsed.baseUrl?.trim());
      parsed.apiUrl = stripTrailingSlash(parsed.apiUrl?.trim());

      if (!this.validateConfig!(parsed)) {
        void handleError(
          new ConfigValidationError(this.validateConfig!.errors),
          "Config",
        );
      }

      this.config = { ...this.config, ...parsed };
    } catch {
      // No config file found
    }
  }

  /**
   * Create a new config file with initial values.
   * @param overwrite If true, overwrites existing config file. Defaults to false
   */
  async saveConfigFile(overwrite = false) {
    const configWithoutDefaults: Partial<Config> = {
      ...this.config,
    };

    // Only include non-default values and $schema
    for (const untypedKey in configWithoutDefaults) {
      const key = untypedKey as keyof Config;
      if (
        !["$schema"].includes(key) &&
        configWithoutDefaults[key] === defaultConfig[key]
      ) {
        delete configWithoutDefaults[key];
      }
    }

    const configJSON = JSON.stringify(configWithoutDefaults, null, 2);

    if (this.configPath && !overwrite) {
      throw new Error("Config file already exists");
    }

    if (this.configPath) {
      await writeFile(this.configPath, configJSON);
    } else {
      // Write to the project path
      const packageJSONPath = await findUp("package.json");
      this.projectPath = dirname(packageJSONPath ?? process.cwd());
      this.configPath = join(this.projectPath, CONFIG_FILE_NAME);
      await writeFile(this.configPath, configJSON);
    }
  }

  getConfig(): Config;
  getConfig<K extends keyof Config>(key: K): Config[K];
  getConfig<K extends keyof Config>(key?: K) {
    return key ? this.config?.[key] : this.config;
  }

  getConfigPath() {
    return this.configPath;
  }

  getProjectPath() {
    return this.projectPath ?? process.cwd();
  }

  setConfig(newConfig: Partial<Config>) {
    // Update the config with new values skipping undefined values
    for (const untypedKey in newConfig) {
      const key = untypedKey as keyof Config;
      if (newConfig[key] === undefined) continue;
      (this.config as any)[key] = newConfig[key];
    }
  }
}

export const configStore = new ConfigStore();
