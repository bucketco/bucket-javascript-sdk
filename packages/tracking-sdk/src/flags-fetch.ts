import fetch from "cross-fetch";

import { SDK_VERSION, SDK_VERSION_HEADER_NAME } from "./config";
import { FlagsResponse } from "./flags";
import { FlagCache, isObject, validateFlags } from "./flags-cache";

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

export type FeatureFlagsResponse = {
  success: boolean;
  flags: FlagsResponse;
};

function validateFeatureFlagsResponse(
  response: any,
): FeatureFlagsResponse | undefined {
  if (!isObject(response)) {
    return;
  }

  if (typeof response.success !== "boolean" || !isObject(response.flags)) {
    return;
  }
  const flags = validateFlags(response.flags);
  if (!flags) {
    return;
  }

  return {
    success: response.success,
    flags,
  };
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

const dedupeFetch: Record<string, Promise<FlagsResponse | undefined>> = {};
export async function fetchFlags(url: string, timeoutMs: number) {
  if (url in dedupeFetch) {
    return dedupeFetch[url];
  }

  const fetchFlagsInner = async () => {
    let flags: FlagsResponse | undefined;
    let success = false;
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      // add SDK version to the query params
      const urlObj = new URL(url);
      urlObj.searchParams.append(SDK_VERSION_HEADER_NAME, SDK_VERSION);

      const res = await fetch(urlObj, {
        signal: controller.signal,
      });

      clearTimeout(id);
      if (!res.ok) {
        throw new Error("unexpected response code: " + res.status);
      }
      const typeRes = validateFeatureFlagsResponse(await res.json());
      if (!typeRes || !typeRes.success) {
        throw new Error("unable to validate response");
      }
      flags = typeRes.flags;
      success = true;
    } catch (e) {
      console.error("[Bucket] error fetching flags: ", e);
    } finally {
      if (success) {
        cache.set(url, { success, flags, attemptCount: 0 });
      } else {
        const current = cache.get(url);
        if (current) {
          // if there is a previous failure cached, increase the attempt count
          cache.set(url, {
            success: current.success,
            flags: current.flags,
            attemptCount: current.attemptCount + 1,
          });
        } else {
          // otherwise cache if the request failed and there is no previous version to extend
          // to avoid having the UI wait and spam the API
          cache.set(url, { success: false, flags, attemptCount: 1 });
        }
      }

      delete dedupeFetch[url];
    }
    return flags;
  };

  dedupeFetch[url] = fetchFlagsInner();
  return dedupeFetch[url];
}

const FLAG_FETCH_DEFAULT_TIMEOUT_MS = 5000;
export const FLAGS_STALE_MS = 60000; // turn stale after 60 seconds, optionally reevaluate in the background
export const FLAGS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // expire entirely after 7 days
const FAILURE_RETRY_ATTEMPTS = 3;
const localStorageCacheKey = `__bucket_flags`;

const cache = new FlagCache(
  {
    get: () => localStorage.getItem(localStorageCacheKey),
    set: (value) => localStorage.setItem(localStorageCacheKey, value),
    clear: () => localStorage.removeItem(localStorageCacheKey),
  },
  FLAGS_STALE_MS,
  FLAGS_EXPIRE_MS,
);

export function clearCache() {
  cache.clear();
}

type GetFlagsResult = {
  flags: FlagsResponse | undefined;
  url: string;
};

// fetch feature flags
export async function getFlags({
  apiBaseUrl,
  context,
  staleWhileRevalidate = true,
  timeoutMs = FLAG_FETCH_DEFAULT_TIMEOUT_MS,
  cacheNegativeAttempts = FAILURE_RETRY_ATTEMPTS,
}: {
  apiBaseUrl: string;
  context: object;
  staleWhileRevalidate?: boolean;
  timeoutMs?: number;
  cacheNegativeAttempts?: number | false;
}): Promise<GetFlagsResult> {
  const flattenedContext = flattenJSON({ context });

  const params = new URLSearchParams(flattenedContext);
  // sort the params to ensure that the URL is the same for the same context
  params.sort();

  const url = `${apiBaseUrl}&${params.toString()}`;
  const cachedItem = cache.get(url);

  // if there's no cached item OR the cached item is a failure and we haven't retried
  // too many times yet - fetch now
  if (
    !cachedItem ||
    (!cachedItem.success &&
      (cacheNegativeAttempts === false ||
        cachedItem.attemptCount < cacheNegativeAttempts))
  ) {
    return { flags: await fetchFlags(url, timeoutMs), url };
  }

  // cachedItem is a success or a failed attempt that we've retried too many times
  if (cachedItem.stale) {
    // serve successful stale cache if `staleWhileRevalidate` is enabled
    if (staleWhileRevalidate && cachedItem.success) {
      // re-fetch in the background, return last successful value
      fetchFlags(url, timeoutMs).catch(() => {
        // we don't care about the result, we just want to re-fetch
      });
      return { flags: cachedItem.flags, url };
    }
    return { flags: await fetchFlags(url, timeoutMs), url };
  }

  // serve cached items if not stale and not expired
  return { flags: cachedItem.flags, url };
}
