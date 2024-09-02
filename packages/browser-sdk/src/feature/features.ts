import { FEATURE_EVENTS_PER_MIN } from "../config";
import { HttpClient } from "../httpClient";
import { Logger, loggerWithPrefix } from "../logger";
import RateLimiter from "../rateLimiter";

import {
  FeatureCache,
  isObject,
  parseAPIFeaturesResponse,
} from "./featureCache";
import maskedProxy from "./maskedProxy";

export type APIFeatureResponse = {
  key: string;
  isEnabled: boolean;
  targetingVersion?: number;
};

export type APIFeaturesResponse = Record<string, APIFeatureResponse>;

export type Features = Record<string, boolean>;

export type FeaturesOptions = {
  fallbackFeatures?: string[];
  timeoutMs?: number;
  staleWhileRevalidate?: boolean;
};

type Config = {
  fallbackFeatures: string[];
  timeoutMs: number;
  staleWhileRevalidate: boolean;
};

export const DEFAULT_FEATURES_CONFIG: Config = {
  fallbackFeatures: [],
  timeoutMs: 5000,
  staleWhileRevalidate: false,
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

export type FeaturesResponse = {
  success: boolean;
  features: APIFeaturesResponse;
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
    } else if (typeof obj[key] === "undefined") {
      continue;
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

export function clearFeatureCache() {
  localStorage.clear();
}

export const FEATURES_STALE_MS = 60000; // turn stale after 60 seconds, optionally reevaluate in the background
export const FEATURES_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000; // expire entirely after 30 days

const localStorageCacheKey = `__bucket_features`;

export class FeaturesClient {
  private cache: FeatureCache;
  private features: Features | undefined;
  private config: Config;
  private rateLimiter: RateLimiter;
  private logger: Logger;

  constructor(
    private httpClient: HttpClient,
    private context: {
      user?: Record<string, any>;
      company?: Record<string, any>;
      other?: Record<string, any>;
    },
    logger: Logger,
    options?: FeaturesOptions & {
      cache?: FeatureCache;
      rateLimiter?: RateLimiter;
    },
  ) {
    this.logger = loggerWithPrefix(logger, "[Features]");
    this.cache = options?.cache
      ? options.cache
      : new FeatureCache({
          storage: {
            get: () => localStorage.getItem(localStorageCacheKey),
            set: (value) => localStorage.setItem(localStorageCacheKey, value),
          },
          staleTimeMs: FEATURES_STALE_MS,
          expireTimeMs: FEATURES_EXPIRE_MS,
        });
    this.config = { ...DEFAULT_FEATURES_CONFIG, ...options };
    this.rateLimiter =
      options?.rateLimiter ??
      new RateLimiter(FEATURE_EVENTS_PER_MIN, this.logger);
  }

  async initialize() {
    const features = (await this.maybeFetchFeatures()) || {};
    this.setFeatures(features);
  }

  private setFeatures(features: APIFeaturesResponse) {
    const proxiedFeatures = maskedProxy(features, (fs, key) => {
      this.sendCheckEvent({
        key,
        version: features[key]?.targetingVersion,
        value: features[key]?.isEnabled ?? false,
      }).catch((e) => {
        this.logger.error("error sending feature check event", e);
      });
      return fs[key]?.isEnabled || false;
    });
    this.features = proxiedFeatures;
  }

  getFeatures(): Features | undefined {
    return this.features;
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

  private async maybeFetchFeatures(): Promise<APIFeaturesResponse | undefined> {
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
    return this.config.fallbackFeatures.reduce((acc, key) => {
      acc[key] = {
        key,
        isEnabled: true,
      };
      return acc;
    }, {} as APIFeaturesResponse);
  }

  public async fetchFeatures(): Promise<APIFeaturesResponse | undefined> {
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
   * @param feature - The feature to send the event for.
   */
  async sendCheckEvent(feature: {
    key: string;
    value: boolean;
    version?: number;
  }) {
    const rateLimitKey = `${this.fetchParams().toString()}:${feature.key}:${feature.version}:${feature.value}`;

    await this.rateLimiter.rateLimited(rateLimitKey, async () => {
      const payload = {
        action: "check",
        key: feature.key,
        targetingVersion: feature.version,
        evalContext: this.context,
        evalResult: feature.value,
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

    return feature.value;
  }
}
