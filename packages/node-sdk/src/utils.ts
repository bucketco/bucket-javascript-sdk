import { Logger } from "./types";

const oneMinute = 60 * 1000;

const eventsByKey: Record<string, number[]> = {};

/**
 * Create a rate-limited function that calls the given function at most `eventsPerMinute` times per minute.
 *
 * @param eventsPerMinute - The maximum number of events per minute.
 * @param func - The function to call.
 * @returns The rate-limited function.
 **/
export function rateLimited<T extends any[], R>(
  eventsPerMinute: number,
  keyFunc: (...args: T) => string,
  func: (...args: T) => R,
): (...funcArgs: T) => R {
  return function (...funcArgs: T): R {
    const now = Date.now();

    const key = keyFunc(...funcArgs);

    if (!eventsByKey[key]) {
      eventsByKey[key] = [];
    }

    const events = eventsByKey[key];

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
 * Create a read-only masked proxy for the given object that notifies a
 * callback when a property is accessed. The callback is then responsible
 * for returning the masked value for the given property.
 *
 * @param obj - The object to proxy.
 * @param callback - The callback to notify.
 *
 * @returns The proxy object.
 **/
export function maskedProxy<T extends object, K extends keyof T, O>(
  obj: T,
  valueFunc: (target: T, prop: K) => O,
) {
  return new Proxy(obj, {
    get(target: T, prop) {
      const val = target[prop as K];

      if (val !== undefined) {
        return valueFunc(target, prop as K);
      }

      return undefined;
    },
    set(_target, prop, _value) {
      console.error(`Cannot modify property '${String(prop)}' of the object.`);
      return true;
    },
  }) as Readonly<Record<K, O>>;
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
