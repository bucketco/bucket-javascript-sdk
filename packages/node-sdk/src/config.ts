import { readFileSync } from "fs";

import { version } from "../package.json";

import { LOG_LEVELS, TypedFlags } from "./types";
import { isObject, ok } from "./utils";

export const API_BASE_URL = "https://front.bucket.co";
export const SDK_VERSION_HEADER_NAME = "reflag-sdk-version";
export const SDK_VERSION = `node-sdk/${version}`;
export const API_TIMEOUT_MS = 10000;
export const END_FLUSH_TIMEOUT_MS = 5000;

export const REFLAG_LOG_PREFIX = "[Reflag]";

export const FLAG_FETCH_RETRIES = 3;

export const FLAG_EVENT_RATE_LIMITER_WINDOW_SIZE_MS = 60 * 1000;

export const FLAGS_REFETCH_MS = 60 * 1000; // re-fetch every 60 seconds

export const BATCH_MAX_SIZE = 100;
export const BATCH_INTERVAL_MS = 10 * 1000;

function parseFlagOverrides(config: object | undefined): TypedFlags {
  if (!config) {
    return {};
  }

  if ("flagOverrides" in config && isObject(config.flagOverrides)) {
    Object.entries(config.flagOverrides).forEach(([key, value]) => {
      ok(
        typeof value === "boolean" || isObject(value),
        `invalid type "${typeof value}" for key ${key}, expected boolean or object`,
      );
      if (isObject(value)) {
        ok(
          typeof value.key === "string",
          `invalid type "${typeof value.key}" for key ${key}.key, expected string`,
        );
        ok(
          typeof value.payload === "boolean" ||
            typeof value.payload === "object" ||
            typeof value.payload === "string" ||
            typeof value.payload === "number",
          `invalid type "${typeof value.payload}" for key ${key}.payload, expected boolean, object, string or number`,
        );
      }
    });

    return config.flagOverrides;
  }

  return {};
}

function loadConfigFile(file: string) {
  const configJson = readFileSync(file, "utf-8");
  const config = JSON.parse(configJson);

  ok(typeof config === "object", "config must be an object");
  const { secretKey, logLevel, offline, host, apiBaseUrl } = config;

  ok(
    typeof secretKey === "undefined" || typeof secretKey === "string",
    "secret must be a string",
  );
  ok(
    typeof apiBaseUrl === "undefined" || typeof apiBaseUrl === "string",
    "apiBaseUrl must be a string",
  );
  ok(
    typeof logLevel === "undefined" ||
      (typeof logLevel === "string" && LOG_LEVELS.includes(logLevel as any)),
    `logLevel must one of ${LOG_LEVELS.join(", ")}`,
  );
  ok(
    typeof offline === "undefined" || typeof offline === "boolean",
    "offline must be a boolean",
  );

  return {
    flagOverrides: parseFlagOverrides(config),
    secretKey,
    logLevel,
    offline,
    apiBaseUrl: host ?? apiBaseUrl,
  };
}

function loadEnvVars() {
  const secretKey = process.env.REFLAG_SECRET_KEY;
  const enabledFlags = process.env.REFLAG_FLAGS_ENABLED;
  const disabledFlags = process.env.REFLAG_FLAGS_DISABLED;
  const logLevel = process.env.REFLAG_LOG_LEVEL;
  const apiBaseUrl = process.env.REFLAG_API_BASE_URL;
  const offline =
    process.env.REFLAG_OFFLINE !== undefined
      ? ["true", "on"].includes(process.env.REFLAG_OFFLINE)
      : undefined;

  let flagOverrides: Record<string, boolean> = {};
  if (enabledFlags) {
    flagOverrides = enabledFlags.split(",").reduce(
      (acc, f) => {
        const key = f.trim();
        if (key) acc[key] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );
  }

  if (disabledFlags) {
    flagOverrides = {
      ...flagOverrides,
      ...disabledFlags.split(",").reduce(
        (acc, f) => {
          const key = f.trim();
          if (key) acc[key] = false;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    };
  }

  return { secretKey, flagOverrides, logLevel, offline, apiBaseUrl };
}

export function loadConfig(file?: string) {
  let fileConfig;
  if (file) {
    fileConfig = loadConfigFile(file);
  }

  const envConfig = loadEnvVars();

  return {
    secretKey: envConfig.secretKey || fileConfig?.secretKey,
    logLevel: envConfig.logLevel || fileConfig?.logLevel,
    offline: envConfig.offline ?? fileConfig?.offline,
    apiBaseUrl: envConfig.apiBaseUrl ?? fileConfig?.apiBaseUrl,
    flagOverrides: {
      ...fileConfig?.flagOverrides,
      ...envConfig.flagOverrides,
    },
  };
}
