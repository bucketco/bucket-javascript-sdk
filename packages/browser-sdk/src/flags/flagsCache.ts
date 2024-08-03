import { APIFlagsResponse } from "./flags";

interface StorageItem {
  get(): string | null;
  set(value: string): void;
}

interface cacheEntry {
  expireAt: number;
  staleAt: number;
  success: boolean; // we also want to cache failures to avoid the UI waiting and spamming the API
  flags: APIFlagsResponse | undefined;
  attemptCount: number;
  updatedAt: number;
}

// Parse and validate an API flag response
export function parseAPIFlagsResponse(
  flagsInput: any,
): APIFlagsResponse | undefined {
  if (!isObject(flagsInput)) {
    return;
  }

  const flags: APIFlagsResponse = {};
  for (const key in flagsInput) {
    const flag = flagsInput[key];
    if (
      typeof flag.value !== "boolean" ||
      flag.key !== key ||
      typeof flag.version !== "number"
    ) {
      return;
    }
    flags[key] = {
      value: flag.value,
      version: flag.version,
      key,
    };
  }
  return flags;
}

export interface CacheResult {
  flags: APIFlagsResponse | undefined;
  stale: boolean;
  success: boolean;
  attemptCount: number;
  updatedAt: number;
}

export class FlagCache {
  private storage: StorageItem;
  private staleTimeMs: number;
  private expireTimeMs: number;

  constructor({
    storage,
    staleTimeMs,
    expireTimeMs,
  }: {
    storage: StorageItem;
    staleTimeMs: number;
    expireTimeMs: number;
  }) {
    this.storage = storage;
    this.staleTimeMs = staleTimeMs;
    this.expireTimeMs = expireTimeMs;
  }

  set(
    key: string,
    {
      success,
      flags,
      attemptCount,
      updatedAt,
    }: {
      success: boolean;
      flags?: APIFlagsResponse;
      attemptCount: number;
      updatedAt: number;
    },
  ) {
    let cacheData: CacheData = {};

    try {
      const cachedResponseRaw = this.storage.get();
      if (cachedResponseRaw) {
        cacheData = validateCacheData(JSON.parse(cachedResponseRaw)) ?? {};
      }
    } catch (e) {
      // ignore errors
    }

    cacheData[key] = {
      expireAt: Date.now() + this.expireTimeMs,
      staleAt: Date.now() + this.staleTimeMs,
      flags,
      success,
      attemptCount,
      updatedAt,
    } satisfies cacheEntry;

    cacheData = Object.fromEntries(
      Object.entries(cacheData).filter(([_k, v]) => v.expireAt > Date.now()),
    );

    this.storage.set(JSON.stringify(cacheData));

    return cacheData;
  }

  get(key: string): CacheResult | undefined {
    try {
      const cachedResponseRaw = this.storage.get();
      if (cachedResponseRaw) {
        const cachedResponse = validateCacheData(JSON.parse(cachedResponseRaw));
        if (
          cachedResponse &&
          cachedResponse[key] &&
          cachedResponse[key].expireAt > Date.now()
        ) {
          return {
            flags: cachedResponse[key].flags,
            success: cachedResponse[key].success,
            stale: cachedResponse[key].staleAt < Date.now(),
            attemptCount: cachedResponse[key].attemptCount,
            updatedAt: cachedResponse[key].updatedAt,
          };
        }
      }
    } catch (e) {
      // ignore errors
    }
    return;
  }
}

type CacheData = Record<string, cacheEntry>;
function validateCacheData(cacheDataInput: any) {
  if (!isObject(cacheDataInput)) {
    return;
  }

  const cacheData: CacheData = {};
  for (const key in cacheDataInput) {
    const cacheEntry = cacheDataInput[key];
    if (!isObject(cacheEntry)) return;

    const { expireAt, staleAt, success, flags, attemptCount, updatedAt } =
      cacheEntry;

    if (
      typeof expireAt !== "number" ||
      typeof staleAt !== "number" ||
      typeof success !== "boolean" ||
      typeof attemptCount !== "number" ||
      typeof updatedAt !== "number" ||
      (flags && !parseAPIFlagsResponse(flags))
    ) {
      return;
    }

    cacheData[key] = {
      expireAt,
      staleAt,
      success,
      flags,
      attemptCount,
      updatedAt,
    };
  }
  return cacheData;
}

// Simple object check.
export function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}
