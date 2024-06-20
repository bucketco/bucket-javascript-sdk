import {
  afterAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  vitest,
} from "vitest";

import { CacheResult, FlagCache } from "../src/flags-cache";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});

afterAll(() => {
  vi.useRealTimers;
});

const TEST_STALE_MS = 1000;
const TEST_EXPIRE_MS = 2000;

function newCache(): { cache: FlagCache; cacheItem: (string | null)[] } {
  const cacheItem: (string | null)[] = [null];
  return {
    cache: new FlagCache(
      {
        get: () => cacheItem[0],
        set: (value) => (cacheItem[0] = value),
        clear: () => (cacheItem[0] = null),
      },
      TEST_STALE_MS,
      TEST_EXPIRE_MS,
    ),
    cacheItem,
  };
}

describe("cache", () => {
  test("caches items", async () => {
    const { cache } = newCache();

    const flags = { featureA: { value: true, key: "featureA" } };

    cache.set("key", { success: true, flags, attemptCount: 1 });
    expect(cache.get("key")).toEqual({
      stale: false,
      success: true,
      flags,
      attemptCount: 1,
    } satisfies CacheResult);
  });

  test("caches unsuccessful items", async () => {
    const { cache } = newCache();

    const flags = { featureA: { value: true, key: "featureA" } };

    cache.set("key", { success: false, flags, attemptCount: 1 });
    expect(cache.get("key")).toEqual({
      stale: false,
      success: false,
      flags,
      attemptCount: 1,
    } satisfies CacheResult);
  });

  test("sets stale", async () => {
    const { cache } = newCache();

    const flags = { featureA: { value: true, key: "featureA" } };

    cache.set("key", { success: true, flags, attemptCount: 1 });

    vitest.advanceTimersByTime(TEST_STALE_MS + 1);

    const cacheItem = cache.get("key");
    expect(cacheItem?.stale).toBe(true);
  });

  test("expires on set", async () => {
    const { cache, cacheItem } = newCache();

    const flags = { featureA: { value: true, key: "featureA" } };

    cache.set("first key", { success: true, flags, attemptCount: 1 });
    expect(cacheItem[0]).not.toBeNull();
    vitest.advanceTimersByTime(TEST_EXPIRE_MS + 1);

    cache.set("other key", { success: true, flags, attemptCount: 1 });

    const item = cache.get("key");
    expect(item).toBeUndefined();
    expect(cacheItem[0]).not.toContain("first key"); // should have been removed
  });
});
