import { Logger } from "./types";

const oneMinute = 60 * 1000;

/**
 * Create a rate-limited function that calls the given function at most `eventsPerMinute` times per minute.
 *
 * @param eventsPerMinute - The maximum number of events per minute.
 * @param func - The function to call.
 * @returns The rate-limited function.
 **/
export function rateLimited<T extends any[], R>(
  eventsPerMinute: number,
  func: (...args: T) => R,
): (...funcArgs: T) => R | void {
  ok(
    typeof eventsPerMinute === "number" && eventsPerMinute > 0,
    "eventsPerMinute must be a positive number",
  );
  ok(typeof func === "function", "func must be a function");

  const events: number[] = [];
  return function (...funcArgs: T): R | void {
    const now = Date.now();

    while (events.length && now - events[0] > oneMinute) {
      events.shift();
    }

    if (events.length >= eventsPerMinute) {
      return;
    }

    events.push(now);
    return func(...funcArgs);
  };
}

/**
 * Create a read-only proxy for the given object that notifies a callback when a property is accessed.
 *
 * @param obj - The object to proxy.
 * @param callback - The callback to notify.
 * @returns The proxy object.
 **/
export function readNotifyProxy<T extends object, K extends keyof T>(
  obj: T,
  callback?: (key: K, value: T[K]) => void,
): Readonly<T> {
  return new Proxy(obj, {
    get(target: T, prop) {
      const val = target[prop as K];

      if (val !== undefined) {
        callback?.(prop as K, val);
      }

      return target[prop as K];
    },
    set() {
      return false;
    },
  });
}

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
export function isObject(item: any) {
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
