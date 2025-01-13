import { FEATURE_EVENTS_PER_MIN } from "../config";
import { HttpClient } from "../httpClient";
import { Logger, loggerWithPrefix } from "../logger";
import RateLimiter from "../rateLimiter";

import {
  FeatureCache,
  isObject,
  parseAPIFeaturesResponse,
} from "./featureCache";

export type RawFeature = {
  /**
   * Feature key
   */
  key: string;

  /**
   * Result of feature flag evaluation
   */
  isEnabled: boolean;

  /**
   * Version of targeting rules
   */
  targetingVersion?: number;

  /**
   * Optional user-defined configuration.
   */
  config?: {
    /**
     * The name of the matched configuration variant.
     */
    name: string | null;
    /**
     * The version of the matched configuration variant.
     */
    version: number;

    /**
     * The user-supplied data.
     */
    payload: any;
  };
};

const FEATURES_UPDATED_EVENT = "features-updated";

export type RawFeatures = Record<string, RawFeature | undefined>;

export type FeaturesOptions = {
  /**
   * Feature keys for which `isEnabled` should fallback to true
   * if SDK fails to fetch features from Bucket servers. If a record
   * is supplied instead of array, the values of each key represent the
   * configuration values and `isEnabled` is assume `true`.
   */
  fallbackFeatures?: string[] | Record<string, any>;

  /**
   * Timeout in milliseconds
   */
  timeoutMs?: number;

  /**
   * If set to true client will return cached value when its stale
   * but refetching
   */
  staleWhileRevalidate?: boolean;
  staleTimeMs?: number;
  expireTimeMs?: number;
};

type Config = {
  fallbackFeatures: Record<string, any>;
  timeoutMs: number;
  staleWhileRevalidate: boolean;
};

export const DEFAULT_FEATURES_CONFIG: Config = {
  fallbackFeatures: {},
  timeoutMs: 5000,
  staleWhileRevalidate: false,
};

// Deep merge two objects.
export type FeaturesResponse = {
  /**
   * `true` if call was successful
   */
  success: boolean;

  /**
   * List of enabled features
   */
  features: RawFeatures;
};

export function validateFeaturesResponse(response: any) {
  if (!isObject(response)) {
    return;
  }

  if (typeof response.success !== "boolean" || !isObject(response.features)) {
    return;
  }

  const features = parseAPIFeaturesResponse(response.features);

  if (!features) {
    return;
  }

  return {
    success: response.success,
    features,
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
    } else if (typeof obj[key] !== "undefined") {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Event representing checking the feature flag evaluation result
 */
export interface CheckEvent {
  /**
   * Feature key
   */
  key: string;

  /**
   * Result of feature flag evaluation
   */
  value: boolean;

  /**
   * Version of targeting rules
   */
  version?: number;
}

type context = {
  user?: Record<string, any>;
  company?: Record<string, any>;
  other?: Record<string, any>;
};

export const FEATURES_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // expire entirely after 30 days

const localStorageCacheKey = `__bucket_features`;

/**
 * @internal
 */
export class FeaturesClient {
  private cache: FeatureCache;
  private features: RawFeatures;
  private config: Config;
  private rateLimiter: RateLimiter;
  private readonly logger: Logger;

  private eventTarget = new EventTarget();
  private abortController: AbortController = new AbortController();

  constructor(
    private httpClient: HttpClient,
    private context: context,
    logger: Logger,
    options?: FeaturesOptions & {
      cache?: FeatureCache;
      rateLimiter?: RateLimiter;
    },
  ) {
    this.features = {};
    this.logger = loggerWithPrefix(logger, "[Features]");
    this.cache = options?.cache
      ? options.cache
      : new FeatureCache({
          storage: {
            get: () => localStorage.getItem(localStorageCacheKey),
            set: (value) => localStorage.setItem(localStorageCacheKey, value),
          },
          staleTimeMs: options?.staleTimeMs ?? 0,
          expireTimeMs: options?.expireTimeMs ?? FEATURES_EXPIRE_MS,
        });

    if (Array.isArray(options?.fallbackFeatures)) {
      options = {
        ...options,
        fallbackFeatures: options.fallbackFeatures.reduce(
          (acc, key) => {
            acc[key] = null;
            return acc;
          },
          {} as Record<string, any>,
        ),
      };
    }

    this.config = { ...DEFAULT_FEATURES_CONFIG, ...options };
    this.rateLimiter =
      options?.rateLimiter ??
      new RateLimiter(FEATURE_EVENTS_PER_MIN, this.logger);
  }

  async initialize() {
    const features = (await this.maybeFetchFeatures()) || {};
    this.setFeatures(features);
  }

  async setContext(context: context) {
    this.context = context;
    await this.initialize();
  }

  /**
   * Stop the client.
   */
  public stop() {
    this.abortController.abort();
  }

  /**
   * Register a callback to be called when the features are updated.
   * Features are not guaranteed to have actually changed when the callback is called.
   *
   * @param callback this will be called when the features are updated.
   * @param options passed as-is to addEventListener, except the abort signal is not supported.
   * @returns a function that can be called to remove the listener
   */
  onUpdated(callback: () => void, options?: AddEventListenerOptions | boolean) {
    this.eventTarget.addEventListener(FEATURES_UPDATED_EVENT, callback, {
      signal: this.abortController.signal,
    });
    return () => {
      this.eventTarget.removeEventListener(
        FEATURES_UPDATED_EVENT,
        callback,
        options,
      );
    };
  }

  getFeatures(): RawFeatures {
    return this.features;
  }

  public async fetchFeatures(): Promise<RawFeatures | undefined> {
    const params = this.fetchParams();
    try {
      const res = await this.httpClient.get({
        path: "/features/enabled",
        timeoutMs: this.config.timeoutMs,
        params,
      });

      if (!res.ok) {
        let errorBody = null;
        try {
          errorBody = await res.json();
        } catch (e) {
          // ignore
        }

        throw new Error(
          "unexpected response code: " +
            res.status +
            " - " +
            JSON.stringify(errorBody),
        );
      }

      const typeRes = validateFeaturesResponse(await res.json());
      if (!typeRes || !typeRes.success) {
        throw new Error("unable to validate response");
      }

      return typeRes.features;
    } catch (e) {
      this.logger.error("error fetching features: ", e);
      return;
    }
  }

  /**
   * Send a feature "check" event.
   *
   *
   * @param checkEvent - The feature to send the event for.
   */
  async sendCheckEvent(checkEvent: CheckEvent) {
    const rateLimitKey = `${this.fetchParams().toString()}:${checkEvent.key}:${checkEvent.version}:${checkEvent.value}`;

    await this.rateLimiter.rateLimited(rateLimitKey, async () => {
      const payload = {
        action: "check",
        key: checkEvent.key,
        targetingVersion: checkEvent.version,
        evalContext: this.context,
        evalResult: checkEvent.value,
      };

      this.httpClient
        .post({
          path: "features/events",
          body: payload,
        })
        .catch((e: any) => {
          this.logger.warn(`failed to send feature check event`, e);
        });

      this.logger.debug(`sent feature event`, payload);
    });

    return checkEvent.value;
  }

  private setFeatures(features: RawFeatures) {
    this.features = features;
    this.eventTarget.dispatchEvent(new Event(FEATURES_UPDATED_EVENT));
  }

  private fetchParams() {
    const flattenedContext = flattenJSON({ context: this.context });
    const params = new URLSearchParams(flattenedContext);
    // publishableKey should be part of the cache key
    params.append("publishableKey", this.httpClient.publishableKey);

    // sort the params to ensure that the URL is the same for the same context
    params.sort();

    return params;
  }

  private async maybeFetchFeatures(): Promise<RawFeatures | undefined> {
    const cacheKey = this.fetchParams().toString();
    const cachedItem = this.cache.get(cacheKey);

    if (cachedItem) {
      if (!cachedItem.stale) return cachedItem.features;

      // serve successful stale cache if `staleWhileRevalidate` is enabled
      if (this.config.staleWhileRevalidate) {
        // re-fetch in the background, but immediately return last successful value
        this.fetchFeatures()
          .then((features) => {
            if (!features) return;

            this.cache.set(cacheKey, {
              features,
            });
            this.setFeatures(features);
          })
          .catch(() => {
            // we don't care about the result, we just want to re-fetch
          });
        return cachedItem.features;
      }
    }

    // if there's no cached item or there is a stale one but `staleWhileRevalidate` is disabled
    // try fetching a new one
    const fetchedFeatures = await this.fetchFeatures();

    if (fetchedFeatures) {
      this.cache.set(cacheKey, {
        features: fetchedFeatures,
      });

      return fetchedFeatures;
    }

    if (cachedItem) {
      // fetch failed, return stale cache
      return cachedItem.features;
    }

    // fetch failed, nothing cached => return fallbacks
    return Object.entries(this.config.fallbackFeatures).reduce(
      (acc, [key, config]) => {
        acc[key] = {
          key,
          isEnabled: true,
          config,
        };
        return acc;
      },
      {} as RawFeatures,
    );
  }
}
