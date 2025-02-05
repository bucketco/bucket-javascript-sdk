import { FetchedFeatures } from "./features";

interface StorageItem {
  get(): string | null;
  set(value: string): void;
}

interface cacheEntry {
  expireAt: number;
  staleAt: number;
  features: FetchedFeatures;
}

// Parse and validate an API feature response
export function parseAPIFeaturesResponse(
  featuresInput: any,
): FetchedFeatures | undefined {
  if (!isObject(featuresInput)) {
    return;
  }

  const features: FetchedFeatures = {};
  for (const key in featuresInput) {
    const feature = featuresInput[key];

    if (
      typeof feature.isEnabled !== "boolean" ||
      feature.key !== key ||
      typeof feature.targetingVersion !== "number" ||
      (feature.config && typeof feature.config !== "object") ||
      (feature.missingContextFields && !Array.isArray(feature.missingContextFields)) ||
      (feature.ruleEvaluationResults && !Array.isArray(feature.ruleEvaluationResults))
    ) {
      return;
    }

    features[key] = {
      isEnabled: feature.isEnabled,
      targetingVersion: feature.targetingVersion,
      key,
      config: feature.config,
      missingContextFields: feature.missingContextFields,
      ruleEvaluationResults: feature.ruleEvaluationResults,
    };
  }

  return features;
}

export interface CacheResult {
  features: FetchedFeatures;
  stale: boolean;
}

export class FeatureCache {
  private storage: StorageItem;
  private readonly staleTimeMs: number;
  private readonly expireTimeMs: number;

  constructor({
    storage,
    staleTimeMs,
    expireTimeMs,
  }: {
    storage: StorageItem;
    staleTimeMs: number;
    expireTimeMs: number;
  }) {
    this.storage = storage;
    this.staleTimeMs = staleTimeMs;
    this.expireTimeMs = expireTimeMs;
  }

  set(
    key: string,
    {
      features,
    }: {
      features: FetchedFeatures;
    },
  ) {
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
      features,
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
            features: cachedResponse[key].features,
            stale: cachedResponse[key].staleAt < Date.now(),
          };
        }
      }
    } catch (e) {
      // ignore errors
    }
    return;
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
      (cacheEntry.features && !parseAPIFeaturesResponse(cacheEntry.features))
    ) {
      return;
    }

    cacheData[key] = {
      expireAt: cacheEntry.expireAt,
      staleAt: cacheEntry.staleAt,
      features: cacheEntry.features,
    };
  }
  return cacheData;
}

// Simple object check.
export function isObject(item: any): boolean {
  return item && typeof item === "object" && !Array.isArray(item);
}
