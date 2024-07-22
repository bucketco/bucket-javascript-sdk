import { Logger } from "../logger";
import { HttpClient } from "../request";
import { FlagCache } from "./flags-cache";
import { validateFeatureFlagsResponse } from "./flags-fetch";

export interface Flag {
  value: boolean;
  key: string;
}

export type FlagsResponse = Record<string, Flag>;

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

export const FLAGS_STALE_MS = 60000; // turn stale after 60 seconds, optionally reevaluate in the background
export const FLAGS_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // expire entirely after 7 days

const localStorageCacheKey = `__bucket_flags`;

export class FlagsClient {
  private cache: FlagCache;
  private flags: FlagsResponse | undefined;
  private config: Config;

  constructor(
    private httpClient: HttpClient,
    private context: BucketContext,
    private logger: Logger,
    config: FeatureFlagsOptions,
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
    this.config = { ...DEFAULT_FLAGS_CONFIG, ...config };
  }

  async initialize() {
    this.flags = await this.initFlags();
  }

  getFlags(): FlagsResponse | undefined {
    return this.flags;
  }

  private async initFlags(): Promise<FlagsResponse | undefined> {
    const flattenedContext = flattenJSON({ context: this.context });

    const params = new URLSearchParams(flattenedContext);
    // sort the params to ensure that the URL is the same for the same context
    params.sort();

    // const url = `/flags/evaluate?` + params.toString();
    const cachedItem = this.cache.get(url);

    // if there's no cached item OR the cached item is a failure and we haven't retried
    // too many times yet - fetch now
    if (
      !cachedItem ||
      (!cachedItem.success &&
        (this.config.failureRetryAttempts === false ||
          cachedItem.attemptCount < this.config.failureRetryAttempts))
    ) {
      return this.fetchFlags(url, this.config.timeoutMs);
    }

    // cachedItem is a success or a failed attempt that we've retried too many times
    if (cachedItem.stale) {
      // serve successful stale cache if `staleWhileRevalidate` is enabled
      if (this.config.staleWhileRevalidate && cachedItem.success) {
        // re-fetch in the background, return last successful value
        this.fetchFlags(url, this.config.timeoutMs).catch(() => {
          // we don't care about the result, we just want to re-fetch
        });
        return cachedItem.flags;
      }
      return this.fetchFlags(url, this.config.timeoutMs);
    }

    // serve cached items if not stale and not expired
    return cachedItem.flags;
  }

  private async fetchFlags(params: URLSearchParams, timeoutMs: number) {
    params.sort();
    const paramsStr = params.toString();
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

      this.cache.set(paramsStr, {
        success: true,
        flags: typeRes.flags,
        attemptCount: 0,
      });
      return typeRes.flags;
    } catch (e) {
      this.logger.error("error fetching flags: ", e);

      const current = this.cache.get(paramsStr);
      if (current) {
        // if there is a previous failure cached, increase the attempt count
        this.cache.set(paramsStr, {
          success: current.success,
          flags: current.flags,
          attemptCount: current.attemptCount + 1,
        });
      } else {
        // otherwise cache if the request failed and there is no previous version to extend
        // to avoid having the UI wait and spam the API
        this.cache.set(paramsStr, {
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
