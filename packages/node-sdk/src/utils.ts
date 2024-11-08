import { Logger } from "./types";

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
 * Check if the given item is an object.
 *
 * @param item - The item to check.
 * @returns `true` if the item is an object, `false` otherwise.
 **/
export function isObject(item: any): item is Record<string, any> {
  return (item && typeof item === "object" && !Array.isArray(item)) || false;
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
    debug: (message: string, ...args: any[]) => {
      logger.debug(`${prefix} ${message}`, ...args);
    },
    info: (message: string, ...args: any[]) => {
      logger.info(`${prefix} ${message}`, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      logger.warn(`${prefix} ${message}`, ...args);
    },
    error: (message: string, ...args: any[]) => {
      logger.error(`${prefix} ${message}`, ...args);
    },
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
