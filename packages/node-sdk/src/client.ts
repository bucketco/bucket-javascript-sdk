import fs from "fs";

import {
  EvaluationResult,
  flattenJSON,
  newEvaluator,
} from "@reflag/flag-evaluation";

import BatchBuffer from "./batch-buffer";
import {
  API_BASE_URL,
  API_TIMEOUT_MS,
  FLAG_EVENT_RATE_LIMITER_WINDOW_SIZE_MS,
  FLAG_FETCH_RETRIES,
  FLAGS_REFETCH_MS,
  loadConfig,
  REFLAG_LOG_PREFIX,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "./config";
import fetchClient, { withRetry } from "./fetch-http-client";
import { subscribe as triggerOnExit } from "./flusher";
import inRequestCache from "./inRequestCache";
import periodicallyUpdatingCache from "./periodicallyUpdatingCache";
import { newRateLimiter } from "./rate-limiter";
import type {
  CachedFlagDefinition,
  CacheStrategy,
  EvaluatedFlagsAPIResponse,
  FeatureDefinition,
  FeatureOverrides,
  FeatureOverridesFn,
  FlagDefinition,
  FlagKey,
  FlagOverridesFn,
  IdType,
  RawFlag,
  TypedFlags,
} from "./types";
import {
  Attributes,
  Cache,
  ClientOptions,
  Context,
  ContextWithTracking,
  FlagEvent,
  FlagsAPIResponse,
  HttpClient,
  Logger,
  TrackingMeta,
  TrackOptions,
  TypedFeatures,
} from "./types";
import {
  applyLogLevel,
  decorateLogger,
  hashObject,
  idOk,
  isObject,
  mergeSkipUndefined,
  ok,
  once,
} from "./utils";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

type BulkEvent =
  | {
      type: "company";
      companyId: IdType;
      userId?: IdType;
      attributes?: Attributes;
      context?: TrackingMeta;
    }
  | {
      type: "user";
      userId: IdType;
      attributes?: Attributes;
      context?: TrackingMeta;
    }
  | {
      type: "feature-flag-event";
      action: "check" | "evaluate" | "check-config" | "evaluate-config";
      key: string;
      targetingVersion?: number;
      evalResult:
        | boolean
        | { key: string; payload: any }
        | { key: undefined; payload: undefined };
      evalContext?: Record<string, any>;
      evalRuleResults?: boolean[];
      evalMissingFields?: string[];
    }
  | {
      type: "event";
      event: string;
      companyId?: IdType;
      userId: IdType;
      attributes?: Attributes;
      context?: TrackingMeta;
    };

/**
 * The SDK client.
 *
 * @remarks
 * This is the main class for interacting with Reflag.
 * It is used to evaluate feature flags, update user and company contexts, and track events.
 *
 * @example
 * ```ts
 * // set the REFLAG_SECRET_KEY environment variable or pass the secret key to the constructor
 * const client = new ReflagClient();
 *
 * // evaluate a feature flag
 * const isFeatureEnabled = client.getFeature("feature-flag-key", {
 *   user: { id: "user-id" },
 *   company: { id: "company-id" },
 * });
 * ```
 **/
export class ReflagClient {
  private _config: {
    apiBaseUrl: string;
    refetchInterval: number;
    staleWarningInterval: number;
    headers: Record<string, string>;
    fallbackFlags?: Record<FlagKey, RawFlag>;
    flagOverrides: FeatureOverridesFn;
    offline: boolean;
    emitEvaluationEvents: boolean;
    configFile?: string;
    fetchRetries: number;
    fetchTimeoutMs: number;
    cacheStrategy: CacheStrategy;
  };
  httpClient: HttpClient;

  private flagsCache: Cache<CachedFlagDefinition[]>;
  private batchBuffer: BatchBuffer<BulkEvent>;
  private rateLimiter: ReturnType<typeof newRateLimiter>;

  /**
   * Gets the logger associated with the client.
   */
  public readonly logger: Logger;

  private initializationFinished = false;
  private _initialize = once(async () => {
    const start = Date.now();
    if (!this._config.offline) {
      await this.flagsCache.refresh();
    }
    this.logger.info(
      "Reflag initialized in " +
        Math.round(Date.now() - start) +
        "ms" +
        (this._config.offline ? " (offline mode)" : ""),
    );
    this.initializationFinished = true;
  });

  /**
   * Creates a new SDK client.
   * See README for configuration options.
   *
   * @param options - The options for the client or an existing client to clone.
   * @param options.secretKey - The secret key to use for the client.
   * @param options.apiBaseUrl - The base URL to send requests to (optional).
   * @param options.logger - The logger to use for logging (optional).
   * @param options.httpClient - The HTTP client to use for sending requests (optional).
   * @param options.logLevel - The log level to use for logging (optional).
   * @param options.offline - Whether to run in offline mode (optional).
   * @param options.fallbackFeatures - The fallback features to use if the feature is not found (optional).
   * @param options.batchOptions - The options for the batch buffer (optional).
   * @param options.featureOverrides - The feature overrides to use for the client (optional).
   * @param options.configFile - The path to the config file (optional).
   * @param options.featuresFetchRetries - Number of retries for fetching features (optional, defaults to 3).
   * @param options.fetchTimeoutMs - Timeout for fetching features (optional, defaults to 10000ms).
   * @param options.cacheStrategy - The cache strategy to use for the client (optional, defaults to "periodically-update").
   *
   * @throws An error if the options are invalid.
   **/
  constructor(options: ClientOptions = {}) {
    ok(isObject(options), "options must be an object");

    ok(
      options.host === undefined ||
        (typeof options.host === "string" && options.host.length > 0),
      "host must be a string",
    );
    ok(
      options.apiBaseUrl === undefined ||
        (typeof options.apiBaseUrl === "string" &&
          options.apiBaseUrl.length > 0),
      "apiBaseUrl must be a string",
    );
    ok(
      options.logger === undefined || isObject(options.logger),
      "logger must be an object",
    );
    ok(
      options.httpClient === undefined || isObject(options.httpClient),
      "httpClient must be an object",
    );
    ok(
      options.fallbackFeatures === undefined ||
        Array.isArray(options.fallbackFeatures) ||
        isObject(options.fallbackFeatures),
      "fallbackFeatures must be an array or object",
    );
    ok(
      options.fallbackFlags === undefined || isObject(options.fallbackFlags),
      "fallbackFlags must be an object",
    );
    ok(
      options.batchOptions === undefined || isObject(options.batchOptions),
      "batchOptions must be an object",
    );
    ok(
      options.configFile === undefined ||
        typeof options.configFile === "string",
      "configFile must be a string",
    );

    ok(
      options.featuresFetchRetries === undefined ||
        (Number.isInteger(options.featuresFetchRetries) &&
          options.featuresFetchRetries >= 0),
      "featuresFetchRetries must be a non-negative integer",
    );

    ok(
      options.flagsFetchRetries === undefined ||
        (Number.isInteger(options.flagsFetchRetries) &&
          options.flagsFetchRetries >= 0),
      "flagsFetchRetries must be a non-negative integer",
    );

    ok(
      options.fetchTimeoutMs === undefined ||
        (Number.isInteger(options.fetchTimeoutMs) &&
          options.fetchTimeoutMs >= 0),
      "fetchTimeoutMs must be a non-negative integer",
    );

    if (!options.configFile) {
      const files = [
        process.env.BUCKET_CONFIG_FILE,
        process.env.REFLAG_CONFIG_FILE,
        "reflagConfig.json",
        "bucketConfig.json",
      ];
      options.configFile = files.find((file) => file && fs.existsSync(file));
    }

    const externalConfig = loadConfig(options.configFile);
    const config = mergeSkipUndefined(externalConfig, options);

    const offline = config.offline ?? process.env.NODE_ENV === "test";
    if (!offline) {
      ok(
        typeof config.secretKey === "string",
        "secretKey must be a string, or set offline=true",
      );
      ok(config.secretKey.length > 22, "invalid secretKey specified");
    }

    // use the supplied logger or apply the log level to the console logger
    const logLevel = options.logLevel ?? config?.logLevel ?? "INFO";

    this.logger = options.logger
      ? options.logger
      : applyLogLevel(decorateLogger(REFLAG_LOG_PREFIX, console), logLevel);

    const fallbackFlagsDeprecated = Array.isArray(options.fallbackFeatures)
      ? options.fallbackFeatures.reduce(
          (acc, key) => {
            acc[key as FlagKey] = {
              isEnabled: true,
              key,
            };
            return acc;
          },
          {} as Record<FlagKey, RawFlag>,
        )
      : isObject(options.fallbackFeatures)
        ? Object.entries(options.fallbackFeatures).reduce(
            (acc, [key, fallback]) => {
              acc[key as FlagKey] = {
                isEnabled:
                  typeof fallback === "object"
                    ? fallback.isEnabled
                    : !!fallback,
                key,
                config:
                  typeof fallback === "object" && fallback.config
                    ? {
                        key: fallback.config.key,
                        payload: fallback.config.payload,
                      }
                    : undefined,
              };
              return acc;
            },
            {} as Record<FlagKey, RawFlag>,
          )
        : undefined;

    const fallbackFlags =
      options.fallbackFlags &&
      Object.entries(options.fallbackFlags).reduce(
        (acc, [key, fallback]) => {
          if (typeof fallback === "object" && fallback) {
            acc[key as FlagKey] = {
              key,
              isEnabled: true,
              config: fallback,
            };
          } else {
            acc[key as FlagKey] = {
              isEnabled: !!fallback,
              key,
            };
          }
          return acc;
        },
        {} as Record<FlagKey, RawFlag>,
      );

    this.rateLimiter = newRateLimiter(FLAG_EVENT_RATE_LIMITER_WINDOW_SIZE_MS);
    this.httpClient = options.httpClient || fetchClient;
    this.batchBuffer = new BatchBuffer<BulkEvent>({
      ...options?.batchOptions,
      flushHandler: (items) => this.sendBulkEvents(items),
      logger: this.logger,
    });

    this._config = {
      offline,
      emitEvaluationEvents: config.emitEvaluationEvents ?? true,
      apiBaseUrl: (config.apiBaseUrl ?? config.host) || API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
        ["Authorization"]: `Bearer ${config.secretKey}`,
      },
      refetchInterval: FLAGS_REFETCH_MS,
      staleWarningInterval: FLAGS_REFETCH_MS * 5,
      fallbackFlags: fallbackFlags ?? fallbackFlagsDeprecated,
      flagOverrides:
        typeof config.featureOverrides === "function"
          ? config.featureOverrides
          : () => config.featureOverrides,
      fetchRetries:
        options.flagsFetchRetries ??
        options.featuresFetchRetries ??
        FLAG_FETCH_RETRIES,
      fetchTimeoutMs: options.fetchTimeoutMs ?? API_TIMEOUT_MS,
      cacheStrategy: options.cacheStrategy ?? "periodically-update",
    };

    if ((config.batchOptions?.flushOnExit ?? true) && !this._config.offline) {
      triggerOnExit(() => this.flush());
    }

    if (!new URL(this._config.apiBaseUrl).pathname.endsWith("/")) {
      this._config.apiBaseUrl += "/";
    }

    const fetchFlags = async () => {
      const res = await this.get<FlagsAPIResponse>(
        "features",
        this._config.fetchRetries,
      );

      if (!isObject(res) || !Array.isArray(res?.features)) {
        this.logger.warn("flags cache: invalid response", res);
        return undefined;
      }

      return res.features.map((flagDef) => {
        return {
          ...flagDef,
          enabledEvaluator: newEvaluator(
            flagDef.targeting.rules.map((rule) => ({
              filter: rule.filter,
              value: true,
            })),
          ),
          configEvaluator: flagDef.config
            ? newEvaluator(
                flagDef.config?.variants.map((variant) => ({
                  filter: variant.filter,
                  value: {
                    key: variant.key,
                    payload: variant.payload,
                  },
                })),
              )
            : undefined,
        } satisfies CachedFlagDefinition;
      });
    };

    if (this._config.cacheStrategy === "periodically-update") {
      this.flagsCache = periodicallyUpdatingCache<CachedFlagDefinition[]>(
        this._config.refetchInterval,
        this._config.staleWarningInterval,
        this.logger,
        fetchFlags,
      );
    } else {
      this.flagsCache = inRequestCache<CachedFlagDefinition[]>(
        this._config.refetchInterval,
        this.logger,
        fetchFlags,
      );
    }
  }

  private _convertFlagOverrides = (overrides: TypedFlags): FeatureOverrides => {
    return Object.fromEntries(
      Object.entries(overrides).map(([key, override]) => {
        if (typeof override === "object" && override) {
          return [
            key,
            {
              isEnabled: true,
              config: {
                key: override.key,
                payload: override.payload,
              },
            },
          ];
        }

        return [key, { isEnabled: !!override }];
      }),
    );
  };

  /**
   * Sets the flag overrides.
   *
   * @param overrides - The flag overrides.
   *
   * @remarks
   * The flag overrides are used to override the flag definitions.
   * This is useful for testing or development.
   *
   * @example
   * ```ts
   * client.flagOverrides = {
   *   "flag-1": true,
   *   "flag-2": false,
   * };
   * ```
   **/
  set flagOverrides(overrides: FlagOverridesFn | TypedFlags) {
    if (typeof overrides === "object") {
      const converted = this._convertFlagOverrides(overrides);
      this._config.flagOverrides = () => converted;
    } else {
      this._config.flagOverrides = (context) =>
        this._convertFlagOverrides(overrides(context));
    }
  }

  /**
   * @deprecated
   * Use `flagOverrides` instead.
   *
   * Sets the feature overrides.
   *
   * @param overrides - The feature overrides.
   *
   * @remarks
   * The feature overrides are used to override the feature definitions.
   * This is useful for testing or development.
   *
   * @example
   * ```ts
   * client.featureOverrides = {
   *   "feature-1": true,
   *   "feature-2": false,
   * };
   * ```
   **/
  set featureOverrides(overrides: FeatureOverridesFn | FeatureOverrides) {
    if (typeof overrides === "object") {
      this._config.flagOverrides = () => overrides;
    } else {
      this._config.flagOverrides = overrides;
    }
  }

  /**
   * @deprecated
   * Use `clearFlagOverrides` instead.
   *
   * Clears the feature overrides.
   *
   * @remarks
   * This is useful for testing or development.
   *
   * @example
   * ```ts
   * afterAll(() => {
   *   client.clearFeatureOverrides();
   * });
   * ```
   **/
  clearFeatureOverrides() {
    this._config.flagOverrides = () => ({});
  }

  /**
   * Clears the flag overrides.
   *
   * @remarks
   * This is useful for testing or development.
   *
   * @example
   * ```ts
   * afterAll(() => {
   *   client.clearFlagOverrides();
   * });
   * ```
   **/
  clearFlagOverrides() {
    this.clearFeatureOverrides();
  }

  /**
   * Returns a new BoundReflagClient with the user/company/otherContext
   * set to be used in subsequent calls.
   * For example, for evaluating feature targeting or tracking events.
   *
   * @param context - The context to bind the client to.
   * @param context.enableTracking - Whether to enable tracking for the context.
   * @param context.user - The user context.
   * @param context.company - The company context.
   * @param context.other - The other context.
   *
   * @returns A new client bound with the arguments given.
   *
   * @throws An error if the user/company is given but their ID is not a string.
   *
   * @remarks
   * The `updateUser` / `updateCompany` methods will automatically be called when
   * the user/company is set respectively.
   **/
  public bindClient({
    enableTracking = true,
    ...context
  }: ContextWithTracking) {
    return new BoundReflagClient(this, { enableTracking, ...context });
  }

  /**
   * Updates the associated user in Reflag.
   *
   * @param userId - The userId of the user to update.
   * @param options - The options for the user.
   * @param options.attributes - The additional attributes of the user (optional).
   * @param options.meta - The meta context associated with tracking (optional).
   *
   * @throws An error if the company is not set or the options are invalid.
   * @remarks
   * The company must be set using `withCompany` before calling this method.
   * If the user is set, the company will be associated with the user.
   **/
  public async updateUser(userId: IdType, options?: TrackOptions) {
    idOk(userId, "userId");
    ok(options === undefined || isObject(options), "options must be an object");
    ok(
      options?.attributes === undefined || isObject(options.attributes),
      "attributes must be an object",
    );
    checkMeta(options?.meta);

    if (this._config.offline) {
      return;
    }

    if (this.rateLimiter.isAllowed(hashObject({ ...options, userId }))) {
      await this.batchBuffer.add({
        type: "user",
        userId,
        attributes: options?.attributes,
        context: options?.meta,
      });
    }
  }

  /**
   * Updates the associated company in Reflag.
   *
   * @param companyId - The companyId of the company to update.
   * @param options - The options for the company.
   * @param options.attributes - The additional attributes of the company (optional).
   * @param options.meta - The meta context associated with tracking (optional).
   * @param options.userId - The userId of the user to associate with the company (optional).
   *
   * @throws An error if the company is not set or the options are invalid.
   * @remarks
   * The company must be set using `withCompany` before calling this method.
   * If the user is set, the company will be associated with the user.
   **/
  public async updateCompany(
    companyId: IdType,
    options?: TrackOptions & { userId?: IdType },
  ) {
    idOk(companyId, "companyId");
    ok(options === undefined || isObject(options), "options must be an object");
    ok(
      options?.attributes === undefined || isObject(options.attributes),
      "attributes must be an object",
    );
    checkMeta(options?.meta);

    if (typeof options?.userId !== "undefined") {
      idOk(options?.userId, "userId");
    }

    if (this._config.offline) {
      return;
    }

    if (this.rateLimiter.isAllowed(hashObject({ ...options, companyId }))) {
      await this.batchBuffer.add({
        type: "company",
        companyId,
        userId: options?.userId,
        attributes: options?.attributes,
        context: options?.meta,
      });
    }
  }

  /**
   * Tracks an event in Reflag.

   * @param options.companyId - Optional company ID for the event (optional).
   *
   * @throws An error if the user is not set or the event is invalid or the options are invalid.
   * @remarks
   * If the company is set, the event will be associated with the company.
   **/
  public async track(
    userId: IdType,
    event: string,
    options?: TrackOptions & { companyId?: IdType },
  ) {
    idOk(userId, "userId");
    ok(typeof event === "string" && event.length > 0, "event must be a string");
    ok(options === undefined || isObject(options), "options must be an object");
    ok(
      options?.attributes === undefined || isObject(options.attributes),
      "attributes must be an object",
    );
    ok(
      options?.meta === undefined || isObject(options.meta),
      "meta must be an object",
    );
    if (options?.companyId !== undefined) {
      idOk(options?.companyId, "companyId");
    }

    if (this._config.offline) {
      return;
    }

    await this.batchBuffer.add({
      type: "event",
      event,
      companyId: options?.companyId,
      userId,
      attributes: options?.attributes,
      context: options?.meta,
    });
  }

  /**
   * Initializes the client by caching the features definitions.
   *
   * @remarks
   * Call this method before calling `getFeatures` to ensure the feature definitions are cached.
   * The client will ignore subsequent calls to this method.
   **/
  public async initialize() {
    await this._initialize();
    return;
  }

  /**
   * Flushes and completes any in-flight fetches in the feature cache.
   *
   * @remarks
   * It is recommended to call this method when the application is shutting down to ensure all events are sent
   * before the process exits.
   *
   * This method is automatically called when the process exits if `batchOptions.flushOnExit` is `true` in the options (default).
   */
  public async flush() {
    if (this._config.offline) {
      return;
    }

    await this.batchBuffer.flush();
    await this.flagsCache.waitRefresh();
  }

  /**
   * @deprecated
   * Use `getFlagDefinitions` instead.
   *
   * Gets the feature definitions, including all config values.
   * To evaluate which features are enabled for a given user/company, use `getFeatures`.
   *
   * @returns The features definitions.
   */
  public getFeatureDefinitions(): FeatureDefinition[] {
    const flags = this.flagsCache.get() || [];
    return flags.map((f) => ({
      key: f.key,
      description: f.description,
      flag: f.targeting,
      config: f.config,
    }));
  }

  /**
   * Gets the flag definitions, including all config values.
   * To evaluate which flags are enabled for a given user/company, use `getFlags`.
   *
   * @returns The flags definitions.
   */
  public getFlagDefinitions(): FlagDefinition[] {
    const flags = this.flagsCache.get() || [];

    return flags.map((f) => {
      if (!f.config) {
        return {
          flagKey: f.key,
          description: f.description,
          version: f.targeting.version,
          type: "toggle",
          rules: f.targeting.rules.map((r) => ({
            filter: r.filter,
            value: true,
          })),
        };
      } else {
        return {
          flagKey: f.key,
          description: f.description,
          version: f.config.version,
          type: "multi-variate",
          rules: f.config!.variants.map((v) => ({
            filter: v.filter,
            value: { key: v.key, payload: v.payload },
          })),
        };
      }
    });
  }

  private _wrapRawFlagAsFeature<TKey extends FlagKey>(
    {
      enableTracking,
      enableChecks = false,
      ...context
    }: { enableTracking: boolean; enableChecks?: boolean } & Context,
    { config, ...feature }: PartialBy<RawFlag, "isEnabled">,
  ): TypedFeatures[TKey] {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const client = this;

    const simplifiedConfig = config
      ? { key: config.key, payload: config.payload }
      : { key: undefined, payload: undefined };

    return {
      get isEnabled() {
        if (enableTracking && enableChecks) {
          client._warnMissingFeatureContextFields(context, feature);

          void client
            .sendFlagEvent({
              action: "check",
              key: feature.key,
              targetingVersion: feature.targetingVersion,
              evalResult: feature.isEnabled ?? false,
              evalContext: context,
              evalRuleResults: feature.ruleEvaluationResults,
              evalMissingFields: feature.missingContextFields,
            })
            .catch((err) => {
              client.logger?.error(
                `failed to send check event for "${feature.key}": ${err}`,
                err,
              );
            });
        }
        return feature.isEnabled ?? false;
      },
      get config() {
        if (enableTracking && enableChecks) {
          client._warnMissingFeatureContextFields(context, feature);

          void client
            .sendFlagEvent({
              action: "check-config",
              key: feature.key,
              targetingVersion: config?.targetingVersion,
              evalResult: simplifiedConfig,
              evalContext: context,
              evalRuleResults: config?.ruleEvaluationResults,
              evalMissingFields: config?.missingContextFields,
            })
            .catch((err) => {
              client.logger?.error(
                `failed to send check event for "${feature.key}": ${err}`,
                err,
              );
            });
        }
        return simplifiedConfig as TypedFeatures[TKey]["config"];
      },
      key: feature.key,
      track: async () => {
        if (typeof context.user?.id === "undefined") {
          this.logger.warn("no user set, cannot track event");
          return;
        }

        if (enableTracking) {
          await this.track(context.user.id, feature.key, {
            companyId: context.company?.id,
          });
        } else {
          this.logger.debug("tracking disabled, not tracking event");
        }
      },
    };
  }

  private _expandRawFlag<TKey extends FlagKey>(
    {
      enableTracking = true,
      enableChecks = false,
      ...context
    }: { enableTracking?: boolean; enableChecks?: boolean } & Context,
    { config, ...flag }: PartialBy<RawFlag, "isEnabled">,
  ): TypedFlags[TKey] {
    if (config?.key) {
      const value = {
        key: config.key,
        payload: config.payload,
      };

      if (enableTracking && enableChecks) {
        this._warnMissingFeatureContextFields(context, config);
        void this.sendFlagEvent({
          action: "check-config",
          key: flag.key,
          targetingVersion: config?.targetingVersion,
          evalResult: value,
          evalContext: context,
          evalRuleResults: config?.ruleEvaluationResults,
          evalMissingFields: config?.missingContextFields,
        }).catch((err) => {
          this.logger?.error(
            `failed to send check event for flag "${flag.key}": ${err}`,
            err,
          );
        });
      }

      return value;
    } else {
      if (enableTracking && enableChecks) {
        this._warnMissingFeatureContextFields(context, flag);
        void this.sendFlagEvent({
          action: "check",
          key: flag.key,
          targetingVersion: flag.targetingVersion,
          evalResult: flag.isEnabled ?? false,
          evalContext: context,
          evalRuleResults: flag.ruleEvaluationResults,
          evalMissingFields: flag.missingContextFields,
        }).catch((err) => {
          this.logger?.error(
            `failed to send check event for flag "${flag.key}": ${err}`,
            err,
          );
        });
      }
      return flag.isEnabled ?? false;
    }
  }

  /**
   * @deprecated
   * Use `getFlags` instead.
   *
   * Gets the evaluated features for the current context which includes the user, company, and custom context.
   *
   * @param options - The options for the context.
   * @param options.enableTracking - Whether to enable tracking for the context.
   * @param options.meta - The meta context associated with the context.
   * @param options.user - The user context.
   * @param options.company - The company context.
   * @param options.other - The other context.
   *
   * @returns The evaluated features.
   *
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no features will be returned otherwise.
   **/
  public getFeatures({
    enableTracking = true,
    ...context
  }: ContextWithTracking): TypedFeatures {
    const flags = this._getRawFlags({ enableTracking, ...context });

    return Object.fromEntries(
      Object.entries(flags).map(([k, v]) => [
        k,
        this._wrapRawFlagAsFeature({ enableTracking, ...context }, v),
      ]),
    );
  }

  /**
   * @deprecated
   * Use `getFlags` instead.
   *
   * Gets the evaluated feature for the current context which includes the user, company, and custom context.
   * Using the `isEnabled` property sends a `check` event to Reflag.
   *
   * @param key - The key of the feature to get.
   * @returns The evaluated feature.
   *
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no features will be returned otherwise.
   **/
  public getFeature<TKey extends FlagKey>(
    { enableTracking = true, ...context }: ContextWithTracking,
    key: TKey,
  ): TypedFeatures[TKey] {
    const flag = this._getRawFlags({ enableTracking, ...context }, key);

    return this._wrapRawFlagAsFeature(
      { ...context, enableTracking, enableChecks: true },
      { key, ...flag },
    );
  }

  /**
   * Gets the evaluated flags for the current context which includes the user, company, and custom context.
   *
   * @param enableTracking - Whether to enable tracking for the context.
   * @param context.meta - The meta context associated with the context.
   * @param context.user - The user context.
   * @param context.company - The company context.
   * @param context.other - The other context.
   *
   * @returns The evaluated flags.
   *
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no flags will be returned otherwise.
   **/
  public getFlags({
    enableTracking = true,
    meta,
    ...context
  }: ContextWithTracking): TypedFlags {
    const flags = this._getRawFlags({ enableTracking, meta, ...context });

    return Object.fromEntries(
      Object.entries(flags).map(([k, v]) => [
        k,
        this._expandRawFlag({ enableTracking, ...context }, v),
      ]),
    );
  }

  /**
   * Gets the evaluated flag for the current context which includes the user, company, and custom context.
   * This method generates a `check` event to Reflag.
   *
   * @param flagKey - The key of the flag to get.
   * @returns The evaluated flag value.
   *
   * @remarks
   * Call `initialize` before calling this method to ensure the flag definitions are cached, no flags will be returned otherwise.
   **/
  public getFlag<TKey extends FlagKey>(
    { enableTracking = true, meta, ...context }: ContextWithTracking,
    flagKey: TKey,
  ): TypedFlags[TKey] {
    const flag = this._getRawFlags(
      { enableTracking, meta, ...context },
      flagKey,
    );

    return this._expandRawFlag(
      { ...context, enableTracking, enableChecks: true },
      { key: flagKey, ...flag },
    );
  }

  /**
   * @deprecated
   * Use `getFlagRemote` instead.
   *
   * Gets evaluated feature with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param key - The key of the feature to get.
   * @param userId - The userId of the user to get the feature for.
   * @param companyId - The companyId of the company to get the feature for.
   * @param additionalContext - The additional context to get the feature for.
   *
   * @returns evaluated feature
   */
  public async getFeatureRemote<TKey extends FlagKey>(
    key: TKey,
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<TypedFeatures[TKey]> {
    const context = this._expandRemoteContext(
      userId,
      companyId,
      additionalContext,
    );

    const flag = await this._evaluateFlagsRemote(key, context);

    return this._wrapRawFlagAsFeature(
      { ...context, enableTracking: true },
      { key, ...flag },
    );
  }

  /**
   * @deprecated
   * Use `getFlagsRemote` instead.
   *
   * Gets evaluated features with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param userId - The userId of the user to get the features for.
   * @param companyId - The companyId of the company to get the features for.
   * @param additionalContext - The additional context to get the features for.
   *
   * @returns evaluated features
   */
  public async getFeaturesRemote(
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<TypedFeatures> {
    const context = this._expandRemoteContext(
      userId,
      companyId,
      additionalContext,
    );

    const flags = await this._evaluateFlagsRemote(undefined, context);

    return Object.fromEntries(
      Object.entries(flags).map(([k, v]) => [
        k,
        this._wrapRawFlagAsFeature({ ...context, enableTracking: true }, v),
      ]),
    );
  }

  /**
   * Evaluates a flag remotely with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param flagKey - The key of the flag to evaluate.
   * @param userId - The userId of the user to evaluate the flag for.
   * @param companyId - The companyId of the company to evaluate the flag for.
   * @param additionalContext - The additional context to evaluate the flag for.
   *
   * @returns evaluated flag value
   */
  public async getFlagRemote<TKey extends FlagKey>(
    flagKey: TKey,
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<TypedFlags[TKey]> {
    const context = this._expandRemoteContext(
      userId,
      companyId,
      additionalContext,
    );

    const flag = await this._evaluateFlagsRemote(flagKey, context);

    return this._expandRawFlag(
      { ...context, enableTracking: true, enableChecks: true },
      { key: flagKey, ...flag },
    );
  }

  /**
   * Gets evaluated features with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param userId - The userId of the user to get the features for.
   * @param companyId - The companyId of the company to get the features for.
   * @param additionalContext - The additional context to get the features for.
   *
   * @returns evaluated features
   */
  public async getFlagsRemote(
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<TypedFlags> {
    const context = this._expandRemoteContext(
      userId,
      companyId,
      additionalContext,
    );

    const flags = await this._evaluateFlagsRemote(undefined, context);

    return Object.fromEntries(
      Object.entries(flags).map(([k, v]) => [
        k,
        this._expandRawFlag({ ...context, enableTracking: true }, v),
      ]),
    );
  }

  private _buildUrl(path: string) {
    if (path.startsWith("/")) {
      path = path.slice(1);
    }

    const url = new URL(path, this._config.apiBaseUrl);
    return url.toString();
  }

  /**
   * Sends a POST request to the specified path.
   *
   * @param path - The path to send the request to.
   * @param body - The body of the request.
   *
   * @returns A boolean indicating if the request was successful.
   *
   * @throws An error if the path or body is invalid.
   **/
  private async post<TBody>(path: string, body: TBody) {
    ok(typeof path === "string" && path.length > 0, "path must be a string");
    ok(typeof body === "object", "body must be an object");

    const url = this._buildUrl(path);
    try {
      const response = await this.httpClient.post<TBody, { success: boolean }>(
        url,
        this._config.headers,
        body,
      );

      this.logger.debug(`post request to "${url}"`, response);

      if (!response.ok || !isObject(response.body) || !response.body.success) {
        this.logger.warn(
          `invalid response received from server for "${url}"`,
          JSON.stringify(response),
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`post request to "${url}" failed with error`, error);
      return false;
    }
  }

  /**
   * Sends a GET request to the specified path.
   *
   * @param path - The path to send the request to.
   * @param retries - Optional number of retries for the request.
   *
   * @returns The response from the server.
   * @throws An error if the path is invalid.
   **/
  private async get<TResponse>(path: string, retries: number = 3) {
    ok(typeof path === "string" && path.length > 0, "path must be a string");

    try {
      const url = this._buildUrl(path);
      return await withRetry(
        async () => {
          const response = await this.httpClient.get<
            TResponse & { success: boolean }
          >(url, this._config.headers, this._config.fetchTimeoutMs);

          this.logger.debug(`get request to "${url}"`, response);

          if (
            !response.ok ||
            !isObject(response.body) ||
            !response.body.success
          ) {
            throw new Error(
              `invalid response received from server for "${url}": ${JSON.stringify(response.body)}`,
            );
          }
          const { success: _, ...result } = response.body;
          return result as TResponse;
        },
        () => {
          this.logger.warn("failed to fetch features, will retry");
        },
        retries,
        1000,
        10000,
      );
    } catch (error) {
      this.logger.error(
        `get request to "${path}" failed with error after ${retries} retries`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Sends a batch of events to the Reflag API.
   *
   * @param events - The events to send.
   *
   * @throws An error if the send fails.
   **/
  private async sendBulkEvents(events: BulkEvent[]) {
    ok(
      Array.isArray(events) && events.length > 0,
      "events must be a non-empty array",
    );

    const sent = await this.post("bulk", events);
    if (!sent) {
      throw new Error("Failed to send bulk events");
    }
  }

  /**
   * Sends a feature event to the Reflag API.
   *
   * Feature events are used to track the evaluation of feature targeting rules.
   * "check" events are sent when a feature's `isEnabled` property is checked.
   * "evaluate" events are sent when a feature's targeting rules are matched against
   * the current context.
   *
   * @param event - The event to send.
   * @param event.action - The action to send.
   * @param event.key - The key of the feature to send.
   * @param event.targetingVersion - The targeting version of the feature to send.
   * @param event.evalResult - The evaluation result of the feature to send.
   * @param event.evalContext - The evaluation context of the feature to send.
   * @param event.evalRuleResults - The evaluation rule results of the feature to send.
   * @param event.evalMissingFields - The evaluation missing fields of the feature to send.
   *
   * @throws An error if the event is invalid.
   *
   * @remarks
   * This method is rate-limited to prevent too many events from being sent.
   **/
  private async sendFlagEvent(event: FlagEvent) {
    ok(typeof event === "object", "event must be an object");
    ok(
      typeof event.action === "string" &&
        (event.action === "evaluate" ||
          event.action === "evaluate-config" ||
          event.action === "check" ||
          event.action === "check-config"),
      "event must have an action",
    );
    ok(
      typeof event.key === "string" && event.key.length > 0,
      "event must have a feature key",
    );
    ok(
      typeof event.targetingVersion === "number" ||
        event.targetingVersion === undefined,
      "event must have a targeting version",
    );
    ok(
      typeof event.evalResult === "boolean" || isObject(event.evalResult),
      "event must have an evaluation result",
    );
    ok(
      event.evalContext === undefined || typeof event.evalContext === "object",
      "event context must be an object",
    );
    ok(
      event.evalRuleResults === undefined ||
        Array.isArray(event.evalRuleResults),
      "event rule results must be an array",
    );
    ok(
      event.evalMissingFields === undefined ||
        Array.isArray(event.evalMissingFields),
      "event missing fields must be an array",
    );

    const contextKey = new URLSearchParams(
      flattenJSON(event.evalContext || {}),
    ).toString();

    if (this._config.offline) {
      return;
    }

    if (
      !this._config.emitEvaluationEvents &&
      (event.action === "evaluate" || event.action === "evaluate-config")
    ) {
      return;
    }

    if (
      !this.rateLimiter.isAllowed(
        hashObject({
          action: event.action,
          key: event.key,
          targetingVersion: event.targetingVersion,
          evalResult: event.evalResult,
          contextKey,
        }),
      )
    ) {
      return;
    }

    await this.batchBuffer.add({
      type: "feature-flag-event",
      action: event.action,
      key: event.key,
      targetingVersion: event.targetingVersion,
      evalContext: event.evalContext,
      evalResult: event.evalResult,
      evalRuleResults: event.evalRuleResults,
      evalMissingFields: event.evalMissingFields,
    });
  }

  /**
   * Updates the context in Reflag (if needed).
   * This method should be used before requesting feature flags or binding a client.
   *
   * @param options - The options for the context.
   * @param options.enableTracking - Whether to enable tracking for the context.
   * @param options.meta - The meta context associated with the context.
   * @param options.user - The user context.
   * @param options.company - The company context.
   * @param options.other - The other context.
   */
  private async syncContext(options: ContextWithTracking) {
    if (!options.enableTracking) {
      this.logger.debug("tracking disabled, not updating user/company");

      return;
    }

    const promises: Promise<void>[] = [];
    if (typeof options.company?.id !== "undefined") {
      const { id: _, ...attributes } = options.company;
      promises.push(
        this.updateCompany(options.company.id, {
          attributes,
          meta: options.meta,
        }),
      );
    }

    if (typeof options.user?.id !== "undefined") {
      const { id: _, ...attributes } = options.user;
      promises.push(
        this.updateUser(options.user.id, {
          attributes,
          meta: options.meta,
        }),
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Warns if a feature has targeting rules that require context fields that are missing.
   *
   * @param context - The context.
   * @param feature - The feature to check.
   */
  private _warnMissingFeatureContextFields(
    context: Context,
    feature: {
      key: string;
      missingContextFields?: string[];
      config?: {
        key: string;
        missingContextFields?: string[];
      };
    },
  ) {
    const report: Record<string, string[]> = {};
    const { config, ...featureData } = feature;

    if (
      featureData.missingContextFields?.length &&
      this.rateLimiter.isAllowed(
        hashObject({
          featureKey: featureData.key,
          missingContextFields: featureData.missingContextFields,
          context,
        }),
      )
    ) {
      report[featureData.key] = featureData.missingContextFields;
    }

    if (
      config?.missingContextFields?.length &&
      this.rateLimiter.isAllowed(
        hashObject({
          featureKey: featureData.key,
          configKey: config.key,
          missingContextFields: config.missingContextFields,
          context,
        }),
      )
    ) {
      report[`${featureData.key}.config`] = config.missingContextFields;
    }

    if (Object.keys(report).length > 0) {
      this.logger.warn(
        `feature/remote config targeting rules might not be correctly evaluated due to missing context fields.`,
        report,
      );
    }
  }

  private _getRawFlags(options: ContextWithTracking): Record<FlagKey, RawFlag>;
  private _getRawFlags<TKey extends FlagKey>(
    options: ContextWithTracking,
    flagKey: TKey,
  ): RawFlag | undefined;
  private _getRawFlags<TKey extends FlagKey>(
    options: ContextWithTracking,
    flagKey?: TKey,
  ): RawFlag | Record<FlagKey, RawFlag> | undefined {
    checkContextWithTracking(options);

    if (!this.initializationFinished) {
      this.logger.error("getFlag(s): ReflagClient is not initialized yet.");
    }

    void this.syncContext(options);
    let flagDefinitions: CachedFlagDefinition[] = [];

    if (!this._config.offline) {
      const onlineFlagDefinitions = this.flagsCache.get();
      if (!onlineFlagDefinitions) {
        this.logger.warn(
          "no flag definitions available, using fallback flags.",
        );

        const fallbackFlags = this._config.fallbackFlags || {};

        if (flagKey) {
          return fallbackFlags[flagKey];
        }

        return fallbackFlags;
      }

      flagDefinitions = onlineFlagDefinitions;
    }

    const { enableTracking = true, meta: _, ...context } = options;

    const evaluated = flagDefinitions
      .filter(({ key }) => (flagKey ? flagKey === key : true))
      .map((flag) => ({
        flagKey: flag.key,
        targetingVersion: flag.targeting.version,
        configVersion: flag.config?.version,
        enabledResult: flag.enabledEvaluator(context, flag.key),
        configResult:
          flag.configEvaluator?.(context, flag.key) ??
          ({
            flagKey: flag.key,
            context,
            value: undefined,
            ruleEvaluationResults: [],
            missingContextFields: [],
          } satisfies EvaluationResult<any>),
      }));

    if (enableTracking) {
      const promises = evaluated
        .map((res) => {
          const outPromises: Promise<void>[] = [];
          outPromises.push(
            this.sendFlagEvent({
              action: "evaluate",
              key: res.flagKey,
              targetingVersion: res.targetingVersion,
              evalResult: res.enabledResult.value ?? false,
              evalContext: res.enabledResult.context,
              evalRuleResults: res.enabledResult.ruleEvaluationResults,
              evalMissingFields: res.enabledResult.missingContextFields,
            }),
          );

          const config = res.configResult;
          if (config.value) {
            outPromises.push(
              this.sendFlagEvent({
                action: "evaluate-config",
                key: res.flagKey,
                targetingVersion: res.configVersion,
                evalResult: config.value,
                evalContext: config.context,
                evalRuleResults: config.ruleEvaluationResults,
                evalMissingFields: config.missingContextFields,
              }),
            );
          }

          return outPromises;
        })
        .flat();

      void Promise.allSettled(promises).then((results) => {
        const failed = results
          .map((result) =>
            result.status === "rejected" ? result.reason : undefined,
          )
          .filter(Boolean);
        if (failed.length > 0) {
          this.logger.error(`failed to queue some evaluate events.`, {
            errors: failed,
          });
        }
      });
    }

    let evaluatedFlags = evaluated.reduce(
      (acc, res) => {
        acc[res.flagKey as FlagKey] = {
          key: res.flagKey,
          isEnabled: res.enabledResult.value ?? false,
          ruleEvaluationResults: res.enabledResult.ruleEvaluationResults,
          missingContextFields: res.enabledResult.missingContextFields,
          targetingVersion: res.targetingVersion,
          config: res.configResult && {
            key: res.configResult.value?.key,
            payload: res.configResult.value?.payload,
            targetingVersion: res.configVersion,
            ruleEvaluationResults: res.configResult.ruleEvaluationResults,
            missingContextFields: res.configResult.missingContextFields,
          },
        };
        return acc;
      },
      {} as Record<FlagKey, RawFlag>,
    );

    // apply feature overrides
    const overrides = Object.entries(this._config.flagOverrides(context))
      .filter(([key]) => (flagKey ? flagKey === key : true))
      .map(([key, override]) => [
        key,
        isObject(override)
          ? {
              key,
              isEnabled: override.isEnabled,
              config: override.config,
            }
          : {
              key,
              isEnabled: !!override,
              config: undefined,
            },
      ]);

    if (overrides.length > 0) {
      // merge overrides into evaluated features
      evaluatedFlags = {
        ...evaluatedFlags,
        ...Object.fromEntries(overrides),
      };
    }

    if (flagKey) {
      return evaluatedFlags[flagKey];
    }

    return evaluatedFlags;
  }

  private _expandRemoteContext(
    userId: IdType | undefined,
    companyId: IdType | undefined,
    additionalContext: Context | undefined,
  ): Context {
    const context = additionalContext || {};
    if (userId) {
      context.user = { id: userId };
    }
    if (companyId) {
      context.company = { id: companyId };
    }

    return context;
  }

  private async _evaluateFlagsRemote(
    flagKey: undefined,
    context: Context,
  ): Promise<Record<FlagKey, RawFlag>>;
  private async _evaluateFlagsRemote<TKey extends FlagKey>(
    flagKey: TKey,
    context: Context,
  ): Promise<RawFlag | undefined>;
  private async _evaluateFlagsRemote<TKey extends FlagKey>(
    flagKey: TKey | undefined,
    context: Context,
  ): Promise<Record<FlagKey, RawFlag> | RawFlag | undefined> {
    checkContext(context);

    const params = new URLSearchParams(
      Object.keys(context).length ? flattenJSON({ context }) : undefined,
    );

    if (flagKey) {
      params.append("key", flagKey);
    }

    const res = await this.get<EvaluatedFlagsAPIResponse>(
      `features/evaluated?${params}`,
    );

    if (flagKey) {
      const flag = res?.features[flagKey];
      if (!flag) {
        this.logger.error(`flag ${flagKey} not found on remote`);
      }

      return flag;
    } else {
      return res?.features ?? {};
    }
  }
}

/**
 * A client bound with a specific user, company, and other context.
 */
export class BoundReflagClient {
  private readonly _client: ReflagClient;
  private readonly _options: ContextWithTracking;

  /**
   * (Internal) Creates a new BoundReflagClient. Use `bindClient` to create a new client bound with a specific context.
   *
   * @param client - The `ReflagClient` to use.
   * @param options - The options for the client.
   * @param options.enableTracking - Whether to enable tracking for the client.
   *
   * @internal
   */
  constructor(
    client: ReflagClient,
    { enableTracking = true, ...context }: ContextWithTracking,
  ) {
    this._client = client;

    this._options = { enableTracking, ...context };

    checkContextWithTracking(this._options);
    void this._client["syncContext"](this._options);
  }

  /**
   * Gets the "other" context associated with the client.
   *
   * @returns The "other" context or `undefined` if it is not set.
   **/
  public get otherContext() {
    return this._options.other;
  }

  /**
   * Gets the user associated with the client.
   *
   * @returns The user or `undefined` if it is not set.
   **/
  public get user() {
    return this._options.user;
  }

  /**
   * Gets the company associated with the client.
   *
   * @returns The company or `undefined` if it is not set.
   **/
  public get company() {
    return this._options.company;
  }

  /**
   * @deprecated
   * Use `getFlags` instead.
   *
   * Get features for the user/company/other context bound to this client.
   * Meant for use in serialization of features for transferring to the client-side/browser.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeatures(): TypedFeatures {
    return this._client.getFeatures(this._options);
  }

  /**
   * @deprecated
   * Use `getFlag` instead.
   *
   * Get a specific feature for the user/company/other context bound to this client.
   * Using the `isEnabled` property sends a `check` event to Reflag.
   *
   * @param key - The key of the feature to get.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeature<TKey extends FlagKey>(key: TKey): TypedFeatures[TKey] {
    return this._client.getFeature(this._options, key);
  }

  /**
   * Get flags for the user/company/other context bound to this client.
   * Meant for use in serialization of features for transferring to the client-side/browser.
   *
   * @returns Flags for the given user/company and whether each one is enabled or not.
   */
  public getFlags(): TypedFlags {
    return this._client.getFlags(this._options);
  }

  /**
   * Get a specific flag for the user/company/other context bound to this client.
   * Using the `isEnabled` property sends a `check` event to Reflag.
   *
   * @param flagKey - The key of the flag to get.
   *
   * @returns Flag for the given user/company and whether it's enabled or not
   */
  public getFlag<TKey extends FlagKey>(flagKey: TKey): TypedFlags[TKey] {
    return this._client.getFlag(this._options, flagKey);
  }

  /**
   * @deprecated
   * Use `getFlagsRemote` instead.
   *
   * Get remotely evaluated feature for the user/company/other context bound to this client.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public async getFeaturesRemote() {
    const { enableTracking: _, meta: __, ...context } = this._options;
    return await this._client.getFeaturesRemote(undefined, undefined, context);
  }

  /**
   * @deprecated
   * Use `getFlagRemote` instead.
   *
   * Get remotely evaluated feature for the user/company/other context bound to this client.
   *
   * @param key - The key of the feature to get.
   *
   * @returns Feature for the given user/company and key and whether it's enabled or not
   */
  public async getFeatureRemote(key: string) {
    const { enableTracking: _, meta: __, ...context } = this._options;
    return await this._client.getFeatureRemote(
      key,
      undefined,
      undefined,
      context,
    );
  }

  /**
   * Evaluate flags remotely for the user/company/other context bound to this client.
   *
   * @returns Flags for the given user/company and whether each one is enabled or not.
   */
  public async getFlagsRemote() {
    const { enableTracking: _, meta: __, ...context } = this._options;
    return await this._client.getFlagsRemote(undefined, undefined, context);
  }

  /**
   * Evaluate a specific flag remotely for the user/company/other context bound to this client.
   *
   * @param flagKey - The key of the flag to get.
   *
   * @returns Flag for the given user/company and key and whether it's enabled or not.
   */
  public async getFlagRemote(flagKey: string) {
    const { enableTracking: _, meta: __, ...context } = this._options;
    return await this._client.getFlagRemote(
      flagKey,
      undefined,
      undefined,
      context,
    );
  }

  /**
   * Track an event in Reflag.
   *
   * @param event - The event to track.
   * @param options - The options for the event.
   * @param options.attributes - The attributes of the event (optional).
   * @param options.meta - The meta context associated with tracking (optional).
   * @param options.companyId - Optional company ID for the event (optional).
   *
   * @throws An error if the event is invalid or the options are invalid.
   */
  public async track(
    event: string,
    options?: TrackOptions & { companyId?: string },
  ) {
    ok(options === undefined || isObject(options), "options must be an object");
    checkMeta(options?.meta);

    const userId = this._options.user?.id;

    if (!userId) {
      this._client.logger?.warn("no user set, cannot track event");
      return;
    }

    if (!this._options.enableTracking) {
      this._client.logger?.debug(
        "tracking disabled for this bound client, not tracking event",
      );
      return;
    }

    await this._client.track(
      userId,
      event,
      options?.companyId
        ? options
        : { ...options, companyId: this._options.company?.id },
    );
  }

  /**
   * Create a new client bound with the additional context.
   * Note: This performs a shallow merge for user/company/other individually.
   *
   * @param context - The context to bind the client to.
   * @param context.user - The user to bind the client to.
   * @param context.company - The company to bind the client to.
   * @param context.other - The other context to bind the client to.
   * @param context.enableTracking - Whether to enable tracking for the client.
   * @param context.meta - The meta context to bind the client to.
   *
   * @returns new client bound with the additional context
   */
  public bindClient({
    user,
    company,
    other,
    enableTracking,
    meta,
  }: ContextWithTracking) {
    // merge new context into existing
    const boundConfig = {
      ...this._options,
      user: user ? { ...this._options.user, ...user } : undefined,
      company: company ? { ...this._options.company, ...company } : undefined,
      other: { ...this._options.other, ...other },
      enableTracking: enableTracking ?? this._options.enableTracking,
      meta: meta ?? this._options.meta,
    };

    return new BoundReflagClient(this._client, boundConfig);
  }

  /**
   * Flushes the batch buffer.
   */
  public async flush() {
    await this._client.flush();
  }
}

function checkMeta(
  meta?: TrackingMeta,
): asserts meta is TrackingMeta | undefined {
  ok(
    typeof meta === "undefined" || isObject(meta),
    "meta must be an object if given",
  );
  ok(
    meta?.active === undefined || typeof meta?.active === "boolean",
    "meta.active must be a boolean if given",
  );
}

function checkContext(context: Context): asserts context is Context {
  ok(isObject(context), "context must be an object");
  ok(
    typeof context.user === "undefined" || isObject(context.user),
    "user must be an object if given",
  );
  if (typeof context.user?.id !== "undefined") {
    idOk(context.user.id, "user.id");
  }

  ok(
    typeof context.company === "undefined" || isObject(context.company),
    "company must be an object if given",
  );
  if (typeof context.company?.id !== "undefined") {
    idOk(context.company.id, "company.id");
  }

  ok(
    context.other === undefined || isObject(context.other),
    "other must be an object if given",
  );
}

function checkContextWithTracking(
  context: ContextWithTracking,
): asserts context is ContextWithTracking & { enableTracking: boolean } {
  checkContext(context);

  ok(
    typeof context.enableTracking === "boolean",
    "enableTracking must be a boolean",
  );

  checkMeta(context.meta);
}

/**
 * @deprecated
 * Use ReflagClient instead
 */
export const BucketClient = ReflagClient;

/**
 * @deprecated
 * Use BoundReflagClient instead
 */
export const BoundBucketClient = BoundReflagClient;
