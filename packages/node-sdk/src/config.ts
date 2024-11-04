import { readFileSync } from "fs";

import { version } from "../package.json";

import { Logger } from "./types";
import { ok } from "./utils";

export const API_HOST = "https://front.bucket.co";
export const SDK_VERSION_HEADER_NAME = "bucket-sdk-version";
export const SDK_VERSION = `node-sdk/${version}`;
export const API_TIMEOUT_MS = 5000;

export const BUCKET_LOG_PREFIX = "[Bucket]";

export const FEATURE_EVENTS_PER_MIN = 1;
export const FEATURES_REFETCH_MS = 60 * 1000; // re-fetch every 60 seconds

export const BATCH_MAX_SIZE = 100;
export const BATCH_INTERVAL_MS = 60 * 1000;

function parseOverrides(config: object | undefined) {
  if (!config) return {};
  if (
    "featureOverrides" in config &&
    typeof config.featureOverrides === "object"
  ) {
    const overrides = config.featureOverrides as object;
    Object.entries(overrides).forEach(([key, value]) => {
      ok(
        typeof value === "boolean",
        `invalid type "${typeof value}" for key ${key}, expected boolean`,
      );
    });
    return overrides;
  }
  return {};
}

function loadConfigFile(file: string) {
  const configJson = readFileSync(file, "utf-8");
  const config = JSON.parse(configJson);

  ok(typeof config === "object", "config must be an object");
  const { secretKey, logLevel, offline, host } = config;
  console.log("secretKey", secretKey);
  ok(
    typeof secretKey === "undefined" || typeof secretKey === "string",
    "secret must be a string",
  );
  ok(
    typeof logLevel === "undefined" ||
      (typeof logLevel === "string" && LOG_LEVELS.includes(logLevel)),
    `logLevel must one of ${LOG_LEVELS.join(", ")}`,
  );
  ok(
    typeof offline === "undefined" || typeof offline === "boolean",
    "offline must be a boolean",
  );

  return {
    featureOverrides: parseOverrides(config),
    secretKey,
    logLevel,
    offline,
    host,
  };
}

function loadEnvVars() {
  const secretKey = process.env.BUCKET_SECRET_KEY;
  const enabledFeatures = process.env.BUCKET_FEATURES_ENABLED;
  const disabledFeatures = process.env.BUCKET_FEATURES_DISABLED;
  const logLevel = process.env.BUCKET_LOG_LEVEL;
  const host = process.env.BUCKET_HOST;
  const offline =
    process.env.BUCKET_OFFLINE !== undefined
      ? ["true", "on"].includes(process.env.BUCKET_OFFLINE)
      : undefined;

  let featureOverrides: Record<string, boolean> = {};
  if (enabledFeatures) {
    featureOverrides = enabledFeatures.split(",").reduce(
      (acc, f) => {
        const key = f.trim();
        if (key) acc[key] = true;
        return acc;
      },
      {} as Record<string, boolean>,
    );
  }

  if (disabledFeatures) {
    featureOverrides = {
      ...featureOverrides,
      ...disabledFeatures.split(",").reduce(
        (acc, f) => {
          const key = f.trim();
          if (key) acc[key] = false;
          return acc;
        },
        {} as Record<string, boolean>,
      ),
    };
  }

  return { secretKey, featureOverrides, logLevel, offline, host };
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
    host: envConfig.host ?? fileConfig?.host,
    featureOverrides: {
      ...fileConfig?.featureOverrides,
      ...envConfig.featureOverrides,
    },
  };
}

const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"];

export function applyLogLevel(logger: Logger, logLevel?: string) {
  switch (logLevel) {
    case "debug":
      return {
        debug: logger.debug,
        info: logger.info,
        warn: logger.warn,
        error: logger.error,
      };
    case "info":
      return {
        debug: () => void 0,
        info: logger.info,
        warn: logger.warn,
        error: logger.error,
      };
    case "warn":
      return {
        debug: () => void 0,
        info: () => void 0,
        warn: logger.warn,
        error: logger.error,
      };
    case "error":
      return {
        debug: () => void 0,
        info: () => void 0,
        warn: () => void 0,
        error: logger.error,
      };
    default:
      return {
        debug: () => void 0,
        info: () => void 0,
        warn: () => void 0,
        error: () => void 0,
      };
  }
}
