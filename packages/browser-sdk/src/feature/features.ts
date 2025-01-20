import { FEATURE_EVENTS_PER_MIN } from "../config";
import { HttpClient } from "../httpClient";
import { Logger, loggerWithPrefix } from "../logger";
import RateLimiter from "../rateLimiter";

import {
  FeatureCache,
  isObject,
  parseAPIFeaturesResponse,
} from "./featureCache";

export type FetchedFeature = {
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
};

const FEATURES_UPDATED_EVENT = "features-updated";

export type FetchedFeatures = Record<string, FetchedFeature | undefined>;
// todo: on next major, come up with a better name for this type. Maybe `LocalFeature`.
export type RawFeature = FetchedFeature & {
  /**
   * If not null, the result is being overridden locally
   */
  isEnabledOverride: boolean | null;
};
export type RawFeatures = Record<string, RawFeature>;

export type FeaturesOptions = {
  /**
   * Feature keys for which `isEnabled` should fallback to true
   * if SDK fails to fetch features from Bucket servers.
   */
  fallbackFeatures?: string[];

  /**
   * Timeout in milliseconds when fetching features
   */
  timeoutMs?: number;

  /**
   * If set to true stale features will be returned while refetching features
   */
  staleWhileRevalidate?: boolean;

  /**
   * If set, features will be cached between page loads for this duration
   */
  expireTimeMs?: number;

  /**
   * Stale features will be returned if staleWhileRevalidate is true if no new features can be fetched
   */
  staleTimeMs?: number;
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
export type FeaturesResponse = {
  /**
   * `true` if call was successful
   */
  success: boolean;

  /**
   * List of enabled features
   */
  features: FetchedFeatures;
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

const localStorageFetchedFeaturesKey = `__bucket_fetched_features`;
const localStorageOverridesKey = `__bucket_overrides`;

type OverridesFeatures = Record<string, boolean | null>;

function setOverridesCache(overrides: OverridesFeatures) {
  localStorage.setItem(localStorageOverridesKey, JSON.stringify(overrides));
}

function getOverridesCache(): OverridesFeatures {
  const cachedOverrides = JSON.parse(
    localStorage.getItem(localStorageOverridesKey) || "{}",
  );

  if (!isObject(cachedOverrides)) {
    return {};
  }

  return cachedOverrides;
}

/**
 * @internal
 */
export class FeaturesClient {
  private cache: FeatureCache;
  private fetchedFeatures: FetchedFeatures;
  private featureOverrides: OverridesFeatures = {};

  private features: RawFeatures = {};

  private config: Config;
  private rateLimiter: RateLimiter;
  private readonly logger: Logger;

  private eventTarget = new EventTarget();
  private abortController: AbortController = new AbortController();

  constructor(
    private httpClient: HttpClient,
    private context: context,
    private featureDefinitions: Readonly<string[]>,
    logger: Logger,
    options?: FeaturesOptions & {
      cache?: FeatureCache;
      rateLimiter?: RateLimiter;
    },
  ) {
    this.fetchedFeatures = {};
    this.logger = loggerWithPrefix(logger, "[Features]");
    this.cache = options?.cache
      ? options.cache
      : new FeatureCache({
          storage: {
            get: () => localStorage.getItem(localStorageFetchedFeaturesKey),
            set: (value) =>
              localStorage.setItem(localStorageFetchedFeaturesKey, value),
          },
          staleTimeMs: options?.staleTimeMs ?? 0,
          expireTimeMs: options?.expireTimeMs ?? FEATURES_EXPIRE_MS,
        });
    this.config = { ...DEFAULT_FEATURES_CONFIG, ...options };
    this.rateLimiter =
      options?.rateLimiter ??
      new RateLimiter(FEATURE_EVENTS_PER_MIN, this.logger);

    try {
      const storedFeatureOverrides = getOverridesCache();
      for (const key in storedFeatureOverrides) {
        if (this.featureDefinitions.includes(key)) {
          this.featureOverrides[key] = storedFeatureOverrides[key];
        }
      }
    } catch (e) {
      this.logger.warn("error getting feature overrides from cache", e);
      this.featureOverrides = {};
    }
  }

  async initialize() {
    const features = (await this.maybeFetchFeatures()) || {};
    this.setFetchedFeatures(features);
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

  public async fetchFeatures(): Promise<FetchedFeatures | undefined> {
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

  private triggerFeaturesChanged() {
    const mergedFeatures: RawFeatures = {};

    // merge fetched features with overrides into `this.features`
    for (const key in this.fetchedFeatures) {
      const fetchedFeature = this.fetchedFeatures[key];
      if (!fetchedFeature) continue;
      const isEnabledOverride = this.featureOverrides[key] ?? null;
      mergedFeatures[key] = {
        ...fetchedFeature,
        isEnabledOverride,
      };
    }

    // add any features that aren't in the fetched features
    for (const key of this.featureDefinitions) {
      if (!mergedFeatures[key]) {
        mergedFeatures[key] = {
          key,
          isEnabled: false,
          isEnabledOverride: this.featureOverrides[key] ?? null,
        };
      }
    }

    this.features = mergedFeatures;

    this.eventTarget.dispatchEvent(new Event(FEATURES_UPDATED_EVENT));
  }

  private setFetchedFeatures(features: FetchedFeatures) {
    this.fetchedFeatures = features;
    this.triggerFeaturesChanged();
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

  private async maybeFetchFeatures(): Promise<FetchedFeatures | undefined> {
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
            this.setFetchedFeatures(features);
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
    }, {} as FetchedFeatures);
  }

  setFeatureOverride(key: string, isEnabled: boolean | null) {
    if (!(typeof isEnabled === "boolean" || isEnabled === null)) {
      throw new Error("setFeatureOverride: isEnabled must be boolean or null");
    }

    if (isEnabled === null) {
      delete this.featureOverrides[key];
    } else {
      this.featureOverrides[key] = isEnabled;
    }
    setOverridesCache(this.featureOverrides);

    this.triggerFeaturesChanged();
  }

  getFeatureOverride(key: string): boolean | null {
    return this.featureOverrides[key] ?? null;
  }
}
