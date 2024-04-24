import fetch from "cross-fetch";

// Simple object check.
export function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}

// Deep merge two objects.
export function mergeDeep(
  target: Record<string, any>,
  ...sources: Record<string, any>[]
): Record<string, any> {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

export interface Flag {
  value: boolean;
  key: string;
}
export type Flags = Record<string, Flag>;

function validateFlags(flagsInput: any): Flags | undefined {
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

export type FeatureFlagsResponse = {
  success: boolean;
  flags: Flags;
};

const dedupeFetch: Record<string, Promise<Flags | undefined>> = {};
export async function fetchFlags(url: string, timeoutMs: number) {
  if (url in dedupeFetch) {
    return dedupeFetch[url];
  }

  const fetchFlagsInner = async () => {
    let flags: Flags | undefined;
    let success = false;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: controller.signal,
      });
      clearTimeout(id);
      const typeRes = (await res.json()) as FeatureFlagsResponse;
      if (!res.ok || !typeRes.success || !validateFlags(typeRes.flags)) {
        throw new Error("Failed to fetch flags");
      }
      flags = validateFlags(typeRes.flags);
      success = typeRes.success ?? false;
    } catch (e) {
      console.error("fetching flags: ", e);
    } finally {
      // we cache even if the request failed to avoid having the UI
      // wait and spam the API
      setCacheItem(url, success, flags);
      delete dedupeFetch[url];
    }
    return flags;
  };

  dedupeFetch[url] = fetchFlagsInner();
  return dedupeFetch[url];
}

function flattenJSON(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key in obj) {
    if (typeof obj[key] === "object") {
      const flat = flattenJSON(obj[key]);
      for (const flatKey in flat) {
        result[`${key}.${flatKey}`] = flat[flatKey];
      }
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

const localStorageCacheKey = `__bucket_flags`;
interface cacheEntry {
  expireAt: number;
  staleAt: number;
  success: boolean; // we also want to cache failures to avoid the UI waiting and spamming the API
  flags: Flags | undefined;
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

const FLAG_FETCH_DEFAULT_TIMEOUT_MS = 5000;
export const FLAGS_STALE_MS = 60000; // turn stale after 60 seconds, optionally reevaluate in the background
export const FLAGS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // expire entirely after 7 days

export function clearCache() {
  localStorage.removeItem(localStorageCacheKey);
}

function setCacheItem(key: string, success: boolean, flags: Flags | undefined) {
  let cacheData: CacheData = {};

  try {
    const cachedResponseRaw = localStorage.getItem(localStorageCacheKey);
    if (cachedResponseRaw) {
      cacheData = validateCacheData(JSON.parse(cachedResponseRaw)) ?? {};
    }
  } catch (e) {} // ignore errors

  cacheData[key] = {
    expireAt: Date.now() + FLAGS_EXPIRE_MS,
    staleAt: Date.now() + FLAGS_STALE_MS,
    flags,
    success,
  } satisfies cacheEntry;

  cacheData = Object.fromEntries(
    Object.entries(cacheData).filter(([_k, v]) => v.expireAt > Date.now()),
  );

  localStorage.setItem(localStorageCacheKey, JSON.stringify(cacheData));

  return cacheData;
}

function getCacheItem(
  key: string,
): { flags: Flags | undefined; stale: boolean; success: boolean } | undefined {
  try {
    const cachedResponseRaw = localStorage.getItem(localStorageCacheKey);
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

// fetch feature flags
export async function getFlags({
  apiBaseUrl,
  context,
  staleWhileRevalidate = true,
  timeoutMs = FLAG_FETCH_DEFAULT_TIMEOUT_MS,
}: {
  apiBaseUrl: string;
  context: object;
  staleWhileRevalidate?: boolean;
  timeoutMs?: number;
}): Promise<Flags | undefined> {
  const flattenedContext = flattenJSON({ context });

  const params = new URLSearchParams(flattenedContext);
  // sort the params to ensure that the URL is the same for the same context
  params.sort();
  const url = `${apiBaseUrl}/flags/evaluate?` + params.toString();

  const cachedItem = getCacheItem(url);
  if (cachedItem) {
    if (!cachedItem.stale) {
      return cachedItem.flags;
    }

    if (cachedItem.success) {
      // if stale, return the cached value and re-fetch in the background
      if (staleWhileRevalidate) {
        // re-fetch in the background, return last successful value
        fetchFlags(url, timeoutMs).catch(() => {
          // we don't care about the result, we just want to re-fetch
        });
        return cachedItem.flags;
      }
    }
  }
  // if not staleWhileRevalidate or cached failure and stale, refetch synchronously
  return fetchFlags(url, timeoutMs);
}
