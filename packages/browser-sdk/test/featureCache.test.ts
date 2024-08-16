import {
  afterAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
  vitest,
} from "vitest";

import { CacheResult, FeatureCache } from "../src/feature/featureCache";

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
});

afterAll(() => {
  vi.useRealTimers;
});

export const TEST_STALE_MS = 1000;
export const TEST_EXPIRE_MS = 2000;

export function newCache(): {
  cache: FeatureCache;
  cacheItem: (string | null)[];
} {
  const cacheItem: (string | null)[] = [null];
  return {
    cache: new FeatureCache({
      storage: {
        get: () => cacheItem[0],
        set: (value) => (cacheItem[0] = value),
      },
      staleTimeMs: TEST_STALE_MS,
      expireTimeMs: TEST_EXPIRE_MS,
    }),
    cacheItem,
  };
}

describe("cache", () => {
  const features = {
    featureA: { isEnabled: true, key: "featureA", targetingVersion: 1 },
  };

  test("caches items", async () => {
    const { cache } = newCache();

    cache.set("key", { features });
    expect(cache.get("key")).toEqual({
      stale: false,
      features,
    } satisfies CacheResult);
  });

  test("sets stale", async () => {
    const { cache } = newCache();

    cache.set("key", { features });

    vitest.advanceTimersByTime(TEST_STALE_MS + 1);

    const cacheItem = cache.get("key");
    expect(cacheItem?.stale).toBe(true);
  });

  test("expires on set", async () => {
    const { cache, cacheItem } = newCache();

    cache.set("first key", {
      features,
    });
    expect(cacheItem[0]).not.toBeNull();
    vitest.advanceTimersByTime(TEST_EXPIRE_MS + 1);

    cache.set("other key", {
      features,
    });

    const item = cache.get("key");
    expect(item).toBeUndefined();
    expect(cacheItem[0]).not.toContain("first key"); // should have been removed
  });
});
