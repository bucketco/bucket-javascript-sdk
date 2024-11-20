import { createHash, Hash } from "crypto";

import { IdType, Logger, LogLevel } from "./types";

/**
 * Assert that the given condition is `true`.
 *
 * @param condition - The condition to check.
 * @param message - The error message to throw.
 **/
export function ok(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(`validation failed: ${message}`);
  }
}
/**
 * Assert that the given values is a valid user/company id
 **/
export function idOk(id: IdType, entity: string) {
  ok(
    (typeof id === "string" && id.length > 0) || typeof id === "number",
    `${entity} must be a string or number if given`,
  );
}

/**
 * Check if the given item is an object.
 *
 * @param item - The item to check.
 * @returns `true` if the item is an object, `false` otherwise.
 **/
export function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === "object" && !Array.isArray(item)) || false;
}

export type LogFn = (message: string, ...args: any[]) => void;
export function decorate(prefix: string, fn: LogFn): LogFn {
  return (message: string, ...args: any[]) => {
    fn(`${prefix} ${message}`, ...args);
  };
}

export function applyLogLevel(logger: Logger, logLevel: LogLevel) {
  switch (logLevel?.toLocaleUpperCase()) {
    case "DEBUG":
      return {
        debug: decorate("[debug]", logger.debug),
        info: decorate("[info]", logger.info),
        warn: decorate("[warn]", logger.warn),
        error: decorate("[error]", logger.error),
      };
    case "INFO":
      return {
        debug: () => void 0,
        info: decorate("[info]", logger.info),
        warn: decorate("[warn]", logger.warn),
        error: decorate("[error]", logger.error),
      };
    case "WARN":
      return {
        debug: () => void 0,
        info: () => void 0,
        warn: decorate("[warn]", logger.warn),
        error: decorate("[error]", logger.error),
      };
    case "ERROR":
      return {
        debug: () => void 0,
        info: () => void 0,
        warn: () => void 0,
        error: decorate("[error]", logger.error),
      };
    default:
      throw new Error(`invalid log level: ${logLevel}`);
  }
}

/**
 * Decorate the messages of a given logger with the given prefix.
 *
 * @param prefix - The prefix to add to log messages.
 * @param logger - The logger to decorate.
 * @returns The decorated logger.
 **/
export function decorateLogger(prefix: string, logger: Logger): Logger {
  ok(typeof prefix === "string", "prefix must be a string");
  ok(typeof logger === "object", "logger must be an object");

  return {
    debug: decorate(prefix, logger.debug),
    info: decorate(prefix, logger.info),
    warn: decorate(prefix, logger.warn),
    error: decorate(prefix, logger.error),
  };
}

/** Merge two objects, skipping `undefined` values.
 *
 * @param target - The target object.
 * @param source - The source object.
 * @returns The merged object.
 **/
export function mergeSkipUndefined<T extends object, U extends object>(
  target: T,
  source: U,
): T & U {
  const newTarget = { ...target };
  for (const key in source) {
    if (source[key] === undefined) {
      continue;
    }
    (newTarget as any)[key] = source[key];
  }
  return newTarget as T & U;
}

function updateSha1Hash(hash: Hash, value: any) {
  if (value === null) {
    hash.update("null");
  } else {
    switch (typeof value) {
      case "object":
        if (Array.isArray(value)) {
          for (const item of value) {
            updateSha1Hash(hash, item);
          }
        } else {
          for (const key of Object.keys(value).sort()) {
            hash.update(key);
            updateSha1Hash(hash, value[key]);
          }
        }
        break;
      case "string":
        hash.update(value);
        break;
      case "number":
      case "boolean":
      case "symbol":
      case "bigint":
        hash.update(value.toString());
        break;
      default:
        break;
    }
  }
}

/** Hash an object using SHA1.
 *
 * @param obj - The object to hash.
 *
 * @returns The SHA1 hash of the object.
 **/
export function hashObject(obj: Record<string, any>): string {
  ok(isObject(obj), "obj must be an object");

  const hash = createHash("sha1");
  updateSha1Hash(hash, obj);

  return hash.digest("hex");
}

export function once<T extends () => ReturnType<T>>(
  fn: T,
): () => ReturnType<T> {
  let called: ReturnType<T> | undefined;
  return function (): ReturnType<T> {
    if (called) {
      return called;
    }
    called = fn();
    return called;
  };
}
