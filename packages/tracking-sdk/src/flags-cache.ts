import { Flags } from "./flags";

interface StorageItem {
  get(): string | null;
  set(value: string): void;
  clear(): void;
}

interface cacheEntry {
  expireAt: number;
  staleAt: number;
  success: boolean; // we also want to cache failures to avoid the UI waiting and spamming the API
  flags: Flags | undefined;
}

export function validateFlags(flagsInput: any): Flags | undefined {
  if (!isObject(flagsInput)) {
    return;
  }

  const flags: Flags = {};
  for (const key in flagsInput) {
    const flag = flagsInput[key];
    if (!isObject(flag)) return;

    if (typeof flag.value !== "boolean" || typeof flag.key !== "string") {
      return;
    }
    flags[key] = { value: flag.value, key: flag.key };
  }
  return flags;
}

export interface CacheResult {
  flags: Flags | undefined;
  stale: boolean;
  success: boolean;
}

export class FlagCache {
  private storage: StorageItem;
  private staleTimeMs: number;
  private expireTimeMs: number;

  constructor(storage: StorageItem, staleTimeMs: number, expireTimeMs: number) {
    this.storage = storage;
    this.staleTimeMs = staleTimeMs;
    this.expireTimeMs = expireTimeMs;
  }

  set(key: string, success: boolean, flags?: Flags) {
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
          };
        }
      }
    } catch (e) {
      console.debug("error loading feature flag cache:", e);
    }
    return;
  }

  clear() {
    this.storage.clear();
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

    if (
      typeof cacheEntry.expireAt !== "number" ||
      typeof cacheEntry.staleAt !== "number" ||
      typeof cacheEntry.success !== "boolean" ||
      (cacheEntry.flags && !validateFlags(cacheEntry.flags))
    ) {
      return;
    }

    cacheData[key] = {
      expireAt: cacheEntry.expireAt,
      staleAt: cacheEntry.staleAt,
      success: cacheEntry.success,
      flags: cacheEntry.flags,
    };
  }
  return cacheData;
}

// Simple object check.
export function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}
