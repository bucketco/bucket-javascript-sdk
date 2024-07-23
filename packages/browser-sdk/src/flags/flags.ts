import { Logger } from "../logger";
import { HttpClient } from "../httpClient";
import { FlagCache } from "./flags-cache";

import { isObject, parseAPIFlagsResponse } from "./flags-cache";
import { BucketContext } from "../context";

export type APIFlagsResponse = Record<
  string,
  {
    value: boolean;
    key: string;
  }
>;

export type Flags = Record<string, boolean>;

export type FeatureFlagsOptions = {
  fallbackFlags?: string[];
  timeoutMs?: number;
  staleWhileRevalidate?: boolean;
  failureRetryAttempts?: number | false;
};

type Config = {
  fallbackFlags: string[];
  timeoutMs: number;
  staleWhileRevalidate: boolean;
  failureRetryAttempts: number | false;
};

export const DEFAULT_FLAGS_CONFIG: Config = {
  fallbackFlags: [],
  timeoutMs: 5000,
  staleWhileRevalidate: false,
  failureRetryAttempts: false,
};

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
  flags: APIFlagsResponse;
};

export function validateFeatureFlagsResponse(response: any) {
  if (!isObject(response)) {
    return;
  }

  if (typeof response.success !== "boolean" || !isObject(response.flags)) {
    return;
  }
  const flags = parseAPIFlagsResponse(response.flags);
  if (!flags) {
    return;
  }

  return {
    success: response.success,
    flags,
  };
}

export function flattenJSON(obj: Record<string, any>): Record<string, any> {
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

export const FLAGS_STALE_MS = 60000; // turn stale after 60 seconds, optionally reevaluate in the background
export const FLAGS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // expire entirely after 7 days

const localStorageCacheKey = `__bucket_flags`;

export class FlagsClient {
  private cache: FlagCache;
  private flags: Flags | undefined;
  private config: Config;

  constructor(
    private httpClient: HttpClient,
    private context: BucketContext,
    private logger: Logger,
    options?: FeatureFlagsOptions,
  ) {
    this.cache = new FlagCache({
      storage: {
        get: () => localStorage.getItem(localStorageCacheKey),
        set: (value) => localStorage.setItem(localStorageCacheKey, value),
        clear: () => localStorage.removeItem(localStorageCacheKey),
      },
      staleTimeMs: FLAGS_STALE_MS,
      expireTimeMs: FLAGS_EXPIRE_MS,
    });
    this.config = { ...DEFAULT_FLAGS_CONFIG, ...options };
  }

  async initialize() {
    this.flags = await this.initFlags();
  }

  getFlags(): Flags | undefined {
    return this.flags;
  }

  private async initFlags(): Promise<Flags | undefined> {
    const flattenedContext = flattenJSON({ context: this.context });

    const params = new URLSearchParams(flattenedContext);
    // publishableKey should be part of the cache key
    params.append("publishableKey", this.httpClient.publishableKey);

    // sort the params to ensure that the URL is the same for the same context
    params.sort();

    const cacheKey = params.toString();
    const cachedItem = this.cache.get(cacheKey);

    // if there's no cached item OR the cached item is a failure and we haven't retried
    // too many times yet - fetch now
    if (
      !cachedItem ||
      (!cachedItem.success &&
        (this.config.failureRetryAttempts === false ||
          cachedItem.attemptCount < this.config.failureRetryAttempts))
    ) {
      return this.fetchFlags(cacheKey, params, this.config.timeoutMs);
    }

    // cachedItem is a success or a failed attempt that we've retried too many times
    if (cachedItem.stale) {
      // serve successful stale cache if `staleWhileRevalidate` is enabled
      if (this.config.staleWhileRevalidate && cachedItem.success) {
        // re-fetch in the background, return last successful value
        this.fetchFlags(cacheKey, params, this.config.timeoutMs).catch(() => {
          // we don't care about the result, we just want to re-fetch
        });
        return cachedItem.flags;
      }
      return this.fetchFlags(cacheKey, params, this.config.timeoutMs);
    }

    // serve cached items if not stale and not expired
    return cachedItem.flags;
  }

  private async fetchFlags(
    cacheKey: string,
    params: URLSearchParams,
    timeoutMs: number,
  ) {
    try {
      const res = await this.httpClient.get({
        path: "/flags/evaluate",
        timeoutMs,
        params,
      });

      if (!res.ok) {
        throw new Error("unexpected response code: " + res.status);
      }
      const typeRes = validateFeatureFlagsResponse(await res.json());
      if (!typeRes || !typeRes.success) {
        throw new Error("unable to validate response");
      }

      this.cache.set(cacheKey, {
        success: true,
        flags: typeRes.flags,
        attemptCount: 0,
      });

      return typeRes.flags;
    } catch (e) {
      this.logger.error("error fetching flags: ", e);

      const current = this.cache.get(cacheKey);
      if (current) {
        // if there is a previous failure cached, increase the attempt count
        this.cache.set(cacheKey, {
          success: current.success,
          flags: current.flags,
          attemptCount: current.attemptCount + 1,
        });
      } else {
        // otherwise cache if the request failed and there is no previous version to extend
        // to avoid having the UI wait and spam the API
        this.cache.set(cacheKey, {
          success: false,
          flags: undefined,
          attemptCount: 1,
        });
      }

      return;
    }
  }

  clearCache() {
    this.cache.clear();
  }
}
