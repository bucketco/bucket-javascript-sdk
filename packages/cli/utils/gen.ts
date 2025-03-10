import { camelCase, kebabCase, pascalCase, snakeCase } from "change-case";

import { Feature, RemoteConfig } from "../services/features.js";

import { JSONToType } from "./json.js";

export type GenFormat = "react" | "node";

// Keep in sync with Bucket main repo
export const KeyFormats = [
  "custom",
  "pascalCase",
  "camelCase",
  "snakeCaseUpper",
  "snakeCaseLower",
  "kebabCaseUpper",
  "kebabCaseLower",
] as const;

export type KeyFormat = (typeof KeyFormats)[number];

type KeyFormatPattern = {
  transform: (key: string) => string;
  validate: (key: string) => true | string;
};

export const KeyFormatPatterns: Record<KeyFormat, KeyFormatPattern> = {
  custom: {
    transform: (key) => key?.trim(),
    validate: (key) =>
      /^[\p{L}\p{N}\p{P}\p{S}\p{Z}]+$/u.test(key) ||
      "Key must contain only letters, numbers, punctuation, symbols, or spaces",
  },
  pascalCase: {
    transform: (key) => pascalCase(key),
    validate: (key) =>
      /^[\p{Lu}][\p{L}\p{N}]*$/u.test(key) ||
      "Key must start with uppercase letter and contain only letters and numbers",
  },
  camelCase: {
    transform: (key) => camelCase(key),
    validate: (key) =>
      /^[\p{Ll}][\p{L}\p{N}]*$/u.test(key) ||
      "Key must start with lowercase letter and contain only letters and numbers",
  },
  snakeCaseUpper: {
    transform: (key) => snakeCase(key).toUpperCase(),
    validate: (key) =>
      /^[\p{Lu}][\p{Lu}\p{N}]*(?:_[\p{Lu}\p{N}]+)*$/u.test(key) ||
      "Key must be uppercase with words separated by underscores",
  },
  snakeCaseLower: {
    transform: (key) => snakeCase(key).toLowerCase(),
    validate: (key) =>
      /^[\p{Ll}][\p{Ll}\p{N}]*(?:_[\p{Ll}\p{N}]+)*$/u.test(key) ||
      "Key must be lowercase with words separated by underscores",
  },
  kebabCaseUpper: {
    transform: (key) => kebabCase(key).toUpperCase(),
    validate: (key) =>
      /^[\p{Lu}][\p{Lu}\p{N}]*(?:-[\p{Lu}\p{N}]+)*$/u.test(key) ||
      "Key must be uppercase with words separated by hyphens",
  },
  kebabCaseLower: {
    transform: (key) => kebabCase(key).toLowerCase(),
    validate: (key) =>
      /^[\p{Ll}][\p{Ll}\p{N}]*(?:-[\p{Ll}\p{N}]+)*$/u.test(key) ||
      "Key must be lowercase with words separated by hyphens",
  },
};

function indentLines(str: string, indent = 2, lineBreak = "\n"): string {
  const indentStr = " ".repeat(indent);
  return str
    .split(lineBreak)
    .map((line) => `${indentStr}${line}`)
    .join(lineBreak);
}

export function genFeatureKey(input: string, format: KeyFormat): string {
  return KeyFormatPatterns[format].transform(input);
}

export function genRemoteConfig(remoteConfigs?: RemoteConfig[]) {
  const variants = remoteConfigs?.[0]?.variants;
  if (!variants?.length) return;
  return JSONToType(
    remoteConfigs![0].variants?.map(({ variant: { payload } }) => ({
      config: { payload },
    })),
  );
}

export function genTypes(features: Feature[], format: GenFormat = "react") {
  const configDefs = new Map<string, { name: string; definition: string }>();
  features.forEach(({ key, name, remoteConfigs }) => {
    const definition = genRemoteConfig(remoteConfigs);
    if (!definition) return;
    const configName = `${pascalCase(name)}Config`;
    configDefs.set(key, { name: configName, definition });
  });

  return /* ts */ `
// DO NOT EDIT THIS FILE. IT IS GENERATED BY THE BUCKET CLI AND WILL BE OVERWRITTEN.
// eslint-disable
// prettier-ignore
import "@bucketco/${format}-sdk";

declare module "@bucketco/${format}-sdk" {
  export interface Features {
${features
  .map(({ key }) => {
    const config = configDefs.get(key);
    return indentLines(
      `"${key}": ${config?.definition ? config.name : "boolean"};`,
      4,
    );
  })
  .join("\n")}
  }

${Array.from(configDefs.values())
  .map(({ name, definition }) => {
    return indentLines(`export type ${name} = ${definition}`);
  })
  .join("\n\n")}
}
`.trim();
}
