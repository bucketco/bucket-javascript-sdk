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

export function validateFeatureFlagsResponse(
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

const FLAG_FETCH_DEFAULT_TIMEOUT_MS = 5000;
export const FLAGS_STALE_MS = 60000; // turn stale after 60 seconds, optionally reevaluate in the background
export const FLAGS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // expire entirely after 7 days
const FAILURE_RETRY_ATTEMPTS = 3;
const localStorageCacheKey = `__bucket_flags`;

const cache = new FlagCache({
  storage: {
    get: () => localStorage.getItem(localStorageCacheKey),
    set: (value) => localStorage.setItem(localStorageCacheKey, value),
    clear: () => localStorage.removeItem(localStorageCacheKey),
  },
  staleTimeMs: FLAGS_STALE_MS,
  expireTimeMs: FLAGS_EXPIRE_MS,
});

export function clearCache() {
  cache.clear();
}

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
}): Promise<FlagsResponse | undefined> {
  const flattenedContext = flattenJSON({ context });

  const params = new URLSearchParams(flattenedContext);
  // sort the params to ensure that the URL is the same for the same context
  params.sort();

  const url = `${apiBaseUrl}/flags/evaluate?` + params.toString();
  const cachedItem = cache.get(url);

  // if there's no cached item OR the cached item is a failure and we haven't retried
  // too many times yet - fetch now
  if (
    !cachedItem ||
    (!cachedItem.success &&
      (cacheNegativeAttempts === false ||
        cachedItem.attemptCount < cacheNegativeAttempts))
  ) {
    return fetchFlags(url, timeoutMs);
  }

  // cachedItem is a success or a failed attempt that we've retried too many times
  if (cachedItem.stale) {
    // serve successful stale cache if `staleWhileRevalidate` is enabled
    if (staleWhileRevalidate && cachedItem.success) {
      // re-fetch in the background, return last successful value
      fetchFlags(url, timeoutMs).catch(() => {
        // we don't care about the result, we just want to re-fetch
      });
      return cachedItem.flags;
    }
    return fetchFlags(url, timeoutMs);
  }

  // serve cached items if not stale and not expired
  return cachedItem.flags;
}
