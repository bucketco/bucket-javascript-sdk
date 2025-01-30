import path from "path";
import { findUp } from "find-up";
import { readJson, writeJson } from "fs-extra/esm";
import { z } from "zod";

import { REPO_CONFIG_FILE } from "./constants.js";
import { Datatype } from "./gen.js";

const ConfigSchema = z.object({
  features: z.array(
    z.union([
      z.string(),
      z.object({
        key: z.string(),
        access: z.boolean().optional(),
        config: z.any().optional(),
      }),
    ]),
  ),
  codeGenBasePath: z.string().optional(),
});

export const initConfig = {
  features: [],
} satisfies z.input<typeof ConfigSchema>;

export const generatedPackageName = "_bucket";

type Config = {
  features: FeatureDef[];
  codeGenBasePath: string;
};

export type FeatureDef = {
  key: string;
  access?: boolean;
  configType?: Datatype;
  fallback?: FallbackValue;
};

export type FallbackValue = {
  isEnabled: boolean;
  config: any;
};

let loadedConfig: Config = {
  features: [],
  codeGenBasePath: "",
};

/**
 * Instantly return a specified key's value or the entire config object.
 */
export function getConfig(): Config;
export function getConfig(key?: keyof Config) {
  return key ? loadedConfig[key] : loadedConfig;
}

export async function findRepoConfig() {
  return await findUp(REPO_CONFIG_FILE);
}

/**
 * Read the config file and return either a specified key's value or the entire config object.
 */
export async function readConfigFile() {
  const location = await findRepoConfig();
  if (!location) {
    throw new Error("No bucket.config.js file found.");
  }
  const parseResult = ConfigSchema.safeParse(await readJson(location));
  if (parseResult.success) {
    return parseResult.data;
  }

  throw new Error("Failed to parse config file: " + parseResult.error.message);
}

/**
 * Write a new value to the config file.
 */
export async function writeConfigFile(config: object, location?: string) {
  const writePath = location ? location : await findRepoConfig();
  if (!writePath)
    throw new Error("writeConfigFile: Could not find config file.");
  await writeJson(writePath, config, { spaces: 2 });
}

export async function loadConfig() {
  const readConfig = await readConfigFile();

  // normalize features to have a key
  const features: FeatureDef[] = readConfig.features.map((feature) => {
    if (typeof feature === "string") {
      return { key: feature };
    }
    return feature;
  });

  loadedConfig = {
    features,
    codeGenBasePath:
      readConfig.codeGenBasePath ?? (await defaultCodeGenBasePath()),
  };
  return loadedConfig;
}

export async function configFileExists() {
  return !!(await findRepoConfig());
}

export async function defaultCodeGenBasePath() {
  const confLocation = (await findRepoConfig()) ?? "";
  return path.join(path.dirname(confLocation), "node_modules");
}
