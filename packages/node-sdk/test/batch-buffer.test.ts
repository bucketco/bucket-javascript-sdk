import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import BatchBuffer from "../src/batch-buffer";
import {
  BATCH_INTERVAL_MS,
  BATCH_MAX_RETRIES,
  BATCH_MAX_SIZE,
  BATCH_RETRY_INTERVAL_MS,
} from "../src/config";
import { Logger } from "../src/types";

describe("BatchBuffer", () => {
  const mockFlushHandler = vi.fn();

  const mockLogger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should throw an error if options are invalid", () => {
      expect(() => new BatchBuffer(null as any)).toThrow(
        "options must be an object",
      );

      expect(() => new BatchBuffer("bad" as any)).toThrow(
        "options must be an object",
      );

      expect(
        () => new BatchBuffer({ flushHandler: null as any } as any),
      ).toThrow("flushHandler must be a function");

      expect(
        () => new BatchBuffer({ flushHandler: "not a function" } as any),
      ).toThrow("flushHandler must be a function");

      expect(
        () =>
          new BatchBuffer({
            flushHandler: mockFlushHandler,
            logger: "string",
          } as any),
      ).toThrow("logger must be an object");

      expect(
        () =>
          new BatchBuffer({
            flushHandler: mockFlushHandler,
            maxSize: -1,
          } as any),
      ).toThrow("maxSize must be greater than 0");

      expect(
        () =>
          new BatchBuffer({
            flushHandler: mockFlushHandler,
            intervalMs: 0,
          } as any),
      ).toThrow("intervalMs must be greater than 0");

      expect(
        () =>
          new BatchBuffer({
            flushHandler: mockFlushHandler,
            maxRetries: -1,
          } as any),
      ).toThrow("maxRetries must be greater than 0");
    });

    it("should initialize with specified values", () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        maxSize: 22,
        intervalMs: 33,
        maxRetries: 44,
        retryIntervalMs: 55,
      });

      expect(buffer).toEqual({
        buffer: [],
        flushHandler: mockFlushHandler,
        retryBuffer: [],
        retryTimer: null,
        timer: null,
        intervalMs: 33,
        logger: undefined,
        maxRetries: 44,
        maxSize: 22,
        retryIntervalMs: 55,
      });
    });

    it("should initialize with default values if not provided", () => {
      const buffer = new BatchBuffer({ flushHandler: mockFlushHandler });
      expect(buffer).toEqual({
        buffer: [],
        flushHandler: mockFlushHandler,
        intervalMs: BATCH_INTERVAL_MS,
        maxRetries: BATCH_MAX_RETRIES,
        maxSize: BATCH_MAX_SIZE,
        retryBuffer: [],
        retryIntervalMs: BATCH_RETRY_INTERVAL_MS,
        retryTimer: null,
        timer: null,
      });
    });
  });

  describe("add", () => {
    it("should add item to the buffer and flush immediately if maxSize is reached", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        maxSize: 1,
      });

      await buffer.add("item1");

      expect(mockFlushHandler).toHaveBeenCalledWith(["item1"]);
      expect(mockFlushHandler).toHaveBeenCalledTimes(1);
    });

    it("should set a flush timer if buffer does not reach maxSize", async () => {
      vi.useFakeTimers();

      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        maxSize: 2,
        intervalMs: 1000,
      });

      await buffer.add("item1");
      expect(mockFlushHandler).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);
      expect(mockFlushHandler).toHaveBeenCalledWith(["item1"]);
      expect(mockFlushHandler).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("flush", () => {
    it("should not do anything if there a re no items to flush", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
      });

      await buffer.flush();

      expect(mockFlushHandler).not.toHaveBeenCalled();

      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        1,
        "buffer is empty. nothing to flush",
      );
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        "retry buffer is empty. nothing to flush",
      );
    });

    it("should flush both buffer and retry buffer", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
      });

      const error = new Error("Failed #1");
      mockFlushHandler.mockRejectedValueOnce(error);
      await buffer.add("item1");
      await buffer.flush();

      expect(mockFlushHandler).toHaveBeenCalledTimes(2);
      expect(mockFlushHandler).toHaveBeenNthCalledWith(1, ["item1"]);
      expect(mockFlushHandler).toHaveBeenNthCalledWith(2, ["item1"]);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "flush of buffered items failed. placing into retry buffer",
        {
          count: 1,
          error,
        },
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "flushed previously failed items",
        {
          count: 1,
        },
      );
    });
  });

  describe("logging", () => {
    it("should log correctly during flush and retries", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
      });

      await buffer.add("item1");
      await buffer.flush();

      expect(mockLogger.info).toHaveBeenCalledWith("flushed buffered items", {
        count: 1,
      });
    });

    it("should log errors during retries", async () => {
      mockFlushHandler.mockRejectedValue(new Error("Flush failed"));

      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
        maxRetries: 1,
      });

      await buffer.add("item1");
      await buffer.flush();

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        1,
        "flush of buffered items failed. placing into retry buffer",
        {
          count: 1,
          error: expect.any(Error),
        },
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        "flushing of previously failed items failed",
        {
          count: 1,
          error: expect.any(Error),
        },
      );
    });
  });

  describe("timer logic", () => {
    beforeAll(() => {
      vi.useFakeTimers();
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    beforeEach(() => {
      vi.clearAllTimers();
      mockFlushHandler.mockReset();
    });

    it("should keep retrying until maxRetries are reached", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
        maxRetries: 3,
        retryIntervalMs: 100,
      });

      const errors = Array.from(
        { length: 4 },
        (_, i) => new Error(`Failed #${i}`),
      );

      errors.forEach((error) => mockFlushHandler.mockRejectedValueOnce(error));

      await buffer.add("item1");
      await buffer.flush();

      await vi.advanceTimersByTimeAsync(300);
      expect(mockFlushHandler).toHaveBeenCalledTimes(4);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "there are still items in the retry buffer. will retry later.",
        {
          count: 1,
        },
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(4);
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        1,
        "flush of buffered items failed. placing into retry buffer",
        {
          count: 1,
          error: errors[0],
        },
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        "flushing of previously failed items failed",
        {
          count: 1,
          error: errors[1],
        },
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        3,
        "flushing of previously failed items failed",
        {
          count: 1,
          error: errors[2],
        },
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        4,
        "flushing of previously failed items failed",
        {
          count: 1,
          error: errors[3],
        },
      );

      expect(buffer["retryTimer"]).toBeNull();
    });

    it("should keep retrying until the retry succeeds", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
        maxRetries: 3,
        retryIntervalMs: 100,
      });

      const errors = Array.from(
        { length: 2 },
        (_, i) => new Error(`Failed #${i}`),
      );

      errors.forEach((error) => mockFlushHandler.mockRejectedValueOnce(error));

      await buffer.add("itemX");
      await buffer.flush();

      await vi.advanceTimersByTimeAsync(200);

      expect(mockFlushHandler).toHaveBeenCalledTimes(3);

      expect(mockLogger.info).toHaveBeenCalledWith(
        "there are still items in the retry buffer. will retry later.",
        {
          count: 1,
        },
      );

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        1,
        "flush of buffered items failed. placing into retry buffer",
        {
          count: 1,
          error: errors[0],
        },
      );
      expect(mockLogger.error).toHaveBeenNthCalledWith(
        2,
        "flushing of previously failed items failed",
        {
          count: 1,
          error: errors[1],
        },
      );

      expect(buffer["retryTimer"]).toBeNull();
    });

    it("should start the normal timer when adding first item", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
        intervalMs: 100,
      });

      expect(buffer["timer"]).toBeNull();
      await buffer.add("item1");

      expect(buffer["timer"]).toBeDefined();

      await vi.advanceTimersByTimeAsync(100);
      expect(mockFlushHandler).toHaveBeenCalledTimes(1);

      expect(buffer["timer"]).toBeNull();

      expect(mockLogger.info).toHaveBeenCalledWith("flushed buffered items", {
        count: 1,
      });
    });

    it("should stop the normal timer if flushed manually", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
        intervalMs: 100,
        maxSize: 2,
      });

      await buffer.add("item1");
      await buffer.add("item2");

      expect(buffer["timer"]).toBeNull();

      expect(mockLogger.info).toHaveBeenCalledWith("flushed buffered items", {
        count: 2,
      });
    });

    it("should start the retry timer when normal flush fails", async () => {
      const buffer = new BatchBuffer({
        flushHandler: mockFlushHandler,
        logger: mockLogger,
        maxSize: 1,
        retryIntervalMs: 100,
      });

      mockFlushHandler.mockRejectedValueOnce(new Error("Flush failed"));

      await buffer.add("item1");

      expect(buffer["timer"]).toBeNull();
      expect(buffer["retryTimer"]).toBeDefined();

      await vi.advanceTimersByTimeAsync(100);
      expect(buffer["retryTimer"]).toBeNull();

      expect(mockLogger.error).toHaveBeenCalledWith(
        "flush of buffered items failed. placing into retry buffer",
        {
          count: 1,
          error: expect.any(Error),
        },
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        "flushed previously failed items",
        {
          count: 1,
        },
      );
    });
  });
});
