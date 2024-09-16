import {
  BATCH_INTERVAL_MS,
  BATCH_MAX_RETRIES,
  BATCH_MAX_SIZE,
  BATCH_RETRY_INTERVAL_MS,
} from "./config";
import { BatchBufferOptions, Logger } from "./types";
import { isObject, ok } from "./utils";

/**
 * A buffer that accumulates items and flushes them in batches.
 * @typeparam T - The type of items to buffer.
 */
export default class BatchBuffer<T> {
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

  /**
   * Creates a new `AccumulatingBuffer` instance.
   * @param options - The options to configure the buffer.
   * @throws If the options are invalid.
   */
  constructor(options: BatchBufferOptions<T>) {
    ok(isObject(options), "options must be an object");
    ok(
      typeof options.flushHandler === "function",
      "flushHandler must be a function",
    );
    ok(isObject(options.logger) || !options.logger, "logger must be an object");
    ok(
      (typeof options.maxSize === "number" && options.maxSize > 0) ||
        typeof options.maxSize !== "number",
      "maxSize must be greater than 0",
    );
    ok(
      (typeof options.intervalMs === "number" && options.intervalMs > 0) ||
        typeof options.intervalMs !== "number",
      "intervalMs must be greater than 0",
    );
    ok(
      (typeof options.retryIntervalMs === "number" &&
        options.retryIntervalMs > 0) ||
        typeof options.retryIntervalMs !== "number",
      "retryIntervalMs must be greater than 0",
    );
    ok(
      (typeof options.maxRetries === "number" && options.maxRetries > 0) ||
        !options.maxRetries,
      "maxRetries must be greater than 0",
    );

    this.flushHandler = options.flushHandler;
    this.logger = options.logger;
    this.maxSize = options.maxSize ?? BATCH_MAX_SIZE;
    this.intervalMs = options.intervalMs ?? BATCH_INTERVAL_MS;
    this.retryIntervalMs = options.retryIntervalMs ?? BATCH_RETRY_INTERVAL_MS;
    this.maxRetries = options.maxRetries ?? BATCH_MAX_RETRIES;
  }

  /**
   * Adds an item to the buffer.
   *
   * @param item - The item to add.
   */
  public async add(item: T) {
    this.buffer.push(item);

    if (this.buffer.length >= this.maxSize) {
      await this.flushBuffer();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flushBuffer(), this.intervalMs);
    }
  }

  /**
   * Flushes the buffer.
   */
  public async flush() {
    await this.flushBuffer();
    await this.flushRetryBuffer();
  }

  private async flushBuffer(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.length === 0) {
      this.logger?.debug("buffer is empty. nothing to flush");
      return;
    }

    try {
      await this.flushHandler(this.buffer);

      this.logger?.info("flushed buffered items", {
        count: this.buffer.length,
      });
    } catch (error) {
      this.logger?.error(
        "flush of buffered items failed. placing into retry buffer",
        { error, count: this.buffer.length },
      );

      this.retryBuffer.push(
        ...this.buffer.map((item) => ({
          triesLeft: this.maxRetries,
          item,
        })),
      );

      this.retryTimer =
        this.retryTimer ||
        setTimeout(() => this.flushRetryBuffer(), this.retryIntervalMs);
    } finally {
      this.buffer = [];
    }
  }

  private async flushRetryBuffer(): Promise<void> {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.retryBuffer.length === 0) {
      this.logger?.debug("retry buffer is empty. nothing to flush");
      return;
    }

    try {
      await this.flushHandler(this.retryBuffer.map((entry) => entry.item));

      this.logger?.info("flushed previously failed items", {
        count: this.retryBuffer.length,
      });

      this.retryBuffer = [];
    } catch (error) {
      this.logger?.error("flushing of previously failed items failed", {
        error,
        count: this.retryBuffer.length,
      });
    }

    this.retryBuffer = this.retryBuffer
      .map(({ triesLeft, item }) => ({
        triesLeft: triesLeft - 1,
        item,
      }))
      .filter(({ triesLeft }) => triesLeft > 0);

    if (this.retryBuffer.length > 0) {
      this.logger?.info(
        "there are still items in the retry buffer. will retry later.",
        {
          count: this.retryBuffer.length,
        },
      );

      this.retryTimer = setTimeout(
        () => this.flushRetryBuffer(),
        this.retryIntervalMs,
      );
    }
  }
}
