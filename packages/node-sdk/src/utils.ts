import assert from "assert";

import { Logger } from "./types";

const oneMinute = 60 * 1000;

let eventsByKey: Record<string, number[]> = {};

export function clearRateLimiter() {
  eventsByKey = {};
}

export function checkWithinAllottedTimeWindow(
  eventsPerMinute: number,
  key: string,
): boolean {
  const now = Date.now();

  if (!eventsByKey[key]) {
    eventsByKey[key] = [];
  }

  const events = eventsByKey[key];

  while (events.length && now - events[0] > oneMinute) {
    events.shift();
  }

  const limitExceeded = events.length >= eventsPerMinute;

  if (!limitExceeded) {
    events.push(now);
  }

  return !limitExceeded;
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

export class AccumulatingBuffer<T> {
  private buffer: T[] = [];
  private retryBuffer: { triesLeft: number; item: T }[] = [];
  private flushHandler: (items: T[]) => Promise<void>;
  private logger?: Logger;
  private maxSize: number;
  private intervalMs: number;
  private retryIntervalMs: number;
  private maxRetries: number;
  private timer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    flushHandler: (items: T[]) => Promise<void>;
    logger?: Logger;
    maxSize?: number;
    intervalMs?: number;
    retryIntervalMs?: number;
    maxRetries?: number;
  }) {
    this.flushHandler = options.flushHandler;
    this.logger = options.logger;
    this.maxSize = options.maxSize ?? 100;
    this.intervalMs = options.intervalMs ?? 60000;
    this.retryIntervalMs = options.retryIntervalMs ?? 60000;
    this.maxRetries = options.maxRetries ?? 3;
  }

  public add(item: T) {
    this.buffer.push(item);

    if (this.buffer.length >= this.maxSize) {
      void this.flush("maxSize");
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        void this.flush("timer");
      }, this.intervalMs);
    }
  }

  private async flush(reason: "timer" | "maxSize"): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    assert(this.buffer.length > 0, "Buffer must not be empty");

    this.logger?.debug("Flushing buffered items.", {
      count: this.buffer.length,
      reason,
    });

    try {
      await this.flushHandler(this.buffer);

      this.logger?.info("Flushed buffered items.", {
        count: this.buffer.length,
        reason,
      });
    } catch (error) {
      this.logger?.error("Flush failed.", { error, reason });

      this.retryBuffer.push(
        ...this.buffer.map((item) => ({
          triesLeft: this.maxRetries,
          item,
        })),
      );

      this.retryTimer =
        this.retryTimer ||
        setTimeout(async () => this.flushRetryBuffer(), this.retryIntervalMs);
    } finally {
      this.buffer = [];
    }
  }

  private async flushRetryBuffer(): Promise<void> {
    assert(this.retryTimer, "Retry timer must be set");

    clearTimeout(this.retryTimer);
    this.retryTimer = null;

    assert(this.buffer.length > 0, "Retry buffer must not be empty");

    try {
      await this.flushHandler(this.retryBuffer.map((entry) => entry.item));

      this.logger?.info(`Successfully flushed previously failed  items`, {
        count: this.retryBuffer.length,
      });

      this.retryBuffer = [];
    } catch (error) {
      this.logger?.error(`Retry flush failed: ${error}`);

      this.retryTimer = setTimeout(() => {
        void this.flushRetryBuffer();
      }, this.retryIntervalMs);
    } finally {
      this.retryBuffer = this.retryBuffer
        .filter(({ triesLeft }) => triesLeft > 0)
        .map(({ triesLeft, item }) => ({
          triesLeft: triesLeft - 1,
          item,
        }));
    }

    if (this.retryBuffer.length > 0) {
      this.logger?.info(
        "There are still items in the retry buffer. Will retry later.",
        {
          count: this.retryBuffer.length,
        },
      );
    }
  }
}
