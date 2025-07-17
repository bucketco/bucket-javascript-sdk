import { FEATURE_EVENTS_PER_MIN } from "../config";
import { HttpClient } from "../httpClient";
import { Logger, loggerWithPrefix } from "../logger";
import RateLimiter from "../rateLimiter";

import {
  FeatureCache,
  isObject,
  parseAPIFeaturesResponse,
} from "./featureCache";

/**
 * A feature fetched from the server.
 */
export type FetchedFeature = {
  /**
   * Feature key.
   */
  key: string;

  /**
   * Result of feature flag evaluation.
   * Note: does not take local overrides into account.
   */
  isEnabled: boolean;

  /**
   * Version of targeting rules.
   */
  targetingVersion?: number;

  /**
   * Rule evaluation results.
   */
  ruleEvaluationResults?: boolean[];

  /**
   * Missing context fields.
   */
  missingContextFields?: string[];

  /**
   * Optional user-defined dynamic configuration.
   */
  config?: {
    /**
     * The key of the matched configuration value.
     */
    key: string;

    /**
     * The version of the matched configuration value.
     */
    version?: number;

    /**
     * The optional user-supplied payload data.
     */
    payload?: any;

    /**
     * The rule evaluation results.
     */
    ruleEvaluationResults?: boolean[];

    /**
     * The missing context fields.
     */
    missingContextFields?: string[];
  };
};

const FEATURES_UPDATED_EVENT = "featuresUpdated";

/**
 * @internal
 */
export type FetchedFeatures = Record<string, FetchedFeature | undefined>;

export type RawFeature = FetchedFeature & {
  /**
   * If not null, the result is being overridden locally
   */
  isEnabledOverride: boolean | null;
};

export type RawFeatures = Record<string, RawFeature>;

export type FallbackFeatureOverride =
  | {
      key: string;
      payload: any;
    }
  | true;

type Config = {
  fallbackFeatures: Record<string, FallbackFeatureOverride>;
  timeoutMs: number;
  staleWhileRevalidate: boolean;
  offline: boolean;
};

export const DEFAULT_FEATURES_CONFIG: Config = {
  fallbackFeatures: {},
  timeoutMs: 5000,
  staleWhileRevalidate: false,
  offline: false,
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
   * `check-is-enabled` means `isEnabled` was checked, `check-config` means `config` was checked.
   */
  action: "check-is-enabled" | "check-config";

  /**
   * Feature key.
   */
  key: string;

  /**
   * Result of feature flag or configuration evaluation.
   * If `action` is `check-is-enabled`, this is the result of the feature flag evaluation and `value` is a boolean.
   * If `action` is `check-config`, this is the result of the configuration evaluation.
   */
  value?: boolean | { key: string; payload: any };

  /**
   * Version of targeting rules.
   */
  version?: number;

  /**
   * Rule evaluation results.
   */
  ruleEvaluationResults?: boolean[];

  /**
   * Missing context fields.
   */
  missingContextFields?: string[];
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
    logger: Logger,
    options?: {
      fallbackFeatures?: Record<string, FallbackFeatureOverride> | string[];
      timeoutMs?: number;
      staleTimeMs?: number;
      expireTimeMs?: number;
      cache?: FeatureCache;
      rateLimiter?: RateLimiter;
      offline?: boolean;
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

    let fallbackFeatures: Record<string, FallbackFeatureOverride>;

    if (Array.isArray(options?.fallbackFeatures)) {
      fallbackFeatures = options.fallbackFeatures.reduce(
        (acc, key) => {
          acc[key] = true;
          return acc;
        },
        {} as Record<string, FallbackFeatureOverride>,
      );
    } else {
      fallbackFeatures = options?.fallbackFeatures ?? {};
    }

    this.config = {
      ...DEFAULT_FEATURES_CONFIG,
      ...options,
      fallbackFeatures,
    };

    this.rateLimiter =
      options?.rateLimiter ??
      new RateLimiter(FEATURE_EVENTS_PER_MIN, this.logger);

    try {
      const storedFeatureOverrides = getOverridesCache();
      for (const key in storedFeatureOverrides) {
        this.featureOverrides[key] = storedFeatureOverrides[key];
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
   * @returns a function that can be called to remove the listener
   */
  onUpdated(callback: () => void) {
    this.eventTarget.addEventListener(FEATURES_UPDATED_EVENT, callback, {
      signal: this.abortController.signal,
    });
  }

  getFeatures(): RawFeatures {
    return this.features;
  }

  getFetchedFeatures(): FetchedFeatures {
    return this.fetchedFeatures;
  }

  public async fetchFeatures(): Promise<FetchedFeatures | undefined> {
    const params = this.fetchParams();
    try {
      const res = await this.httpClient.get({
        path: "/features/evaluated",
        timeoutMs: this.config.timeoutMs,
        params,
      });

      if (!res.ok) {
        let errorBody = null;
        try {
          errorBody = await res.json();
        } catch {
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
   * @param cb - Callback to call after the event is sent. Might be skipped if the event was rate limited.
   */
  async sendCheckEvent(checkEvent: CheckEvent, cb: () => void) {
    if (this.config.offline) {
      return;
    }

    const rateLimitKey = `check-event:${this.fetchParams().toString()}:${checkEvent.key}:${checkEvent.version}:${checkEvent.value}`;
    await this.rateLimiter.rateLimited(rateLimitKey, async () => {
      const payload = {
        action: checkEvent.action,
        key: checkEvent.key,
        targetingVersion: checkEvent.version,
        evalContext: this.context,
        evalResult: checkEvent.value,
        evalRuleResults: checkEvent.ruleEvaluationResults,
        evalMissingFields: checkEvent.missingContextFields,
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
      cb();
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

  private warnMissingFeatureContextFields(features: FetchedFeatures) {
    const report: Record<string, string[]> = {};
    for (const featureKey in features) {
      const feature = features[featureKey];
      if (feature?.missingContextFields?.length) {
        report[feature.key] = feature.missingContextFields;
      }

      if (feature?.config?.missingContextFields?.length) {
        report[`${feature.key}.config`] = feature.config.missingContextFields;
      }
    }

    if (Object.keys(report).length > 0) {
      this.rateLimiter.rateLimited(
        `feature-missing-context-fields:${this.fetchParams().toString()}`,
        () => {
          this.logger.warn(
            `feature/remote config targeting rules might not be correctly evaluated due to missing context fields.`,
            report,
          );
        },
      );
    }
  }

  private async maybeFetchFeatures(): Promise<FetchedFeatures | undefined> {
    if (this.config.offline) {
      return;
    }

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

      this.warnMissingFeatureContextFields(fetchedFeatures);
      return fetchedFeatures;
    }

    if (cachedItem) {
      // fetch failed, return stale cache
      return cachedItem.features;
    }

    // fetch failed, nothing cached => return fallbacks
    return Object.entries(this.config.fallbackFeatures).reduce(
      (acc, [key, override]) => {
        acc[key] = {
          key,
          isEnabled: !!override,
          config:
            typeof override === "object" && "key" in override
              ? {
                  key: override.key,
                  payload: override.payload,
                }
              : undefined,
        };
        return acc;
      },
      {} as FetchedFeatures,
    );
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
