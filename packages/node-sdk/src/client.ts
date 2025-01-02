import fs from "fs";

import { evaluateFeatureRules, flattenJSON } from "@bucketco/flag-evaluation";

import BatchBuffer from "./batch-buffer";
import cache from "./cache";
import {
  API_HOST,
  BUCKET_LOG_PREFIX,
  FEATURE_EVENT_RATE_LIMITER_WINDOW_SIZE_MS,
  FEATURES_REFETCH_MS,
  loadConfig,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "./config";
import fetchClient from "./fetch-http-client";
import { newRateLimiter } from "./rate-limiter";
import type {
  EvaluatedFeaturesAPIResponse,
  FeatureOverridesFn,
  IdType,
  RawFeature,
} from "./types";
import {
  Attributes,
  Cache,
  ClientOptions,
  Context,
  Feature,
  FeatureEvent,
  FeaturesAPIResponse,
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

const bucketConfigDefaultFile = "bucketConfig.json";

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
      action: "check" | "evaluate";
      key: string;
      targetingVersion?: number;
      evalResult: boolean;
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
 * A context with tracking option.
 **/
interface ContextWithTracking extends Context {
  /**
   * Enable tracking for the context.
   * If set to `false`, tracking will be disabled for the context. Default is `true`.
   */
  enableTracking?: boolean;
}

/**
 * The SDK client.
 *
 **/
export class BucketClient {
  private _config: {
    logger?: Logger;
    host: string;
    httpClient: HttpClient;
    refetchInterval: number;
    staleWarningInterval: number;
    headers: Record<string, string>;
    fallbackFeatures?: Record<keyof TypedFeatures, RawFeature>;
    featuresCache?: Cache<FeaturesAPIResponse>;
    batchBuffer: BatchBuffer<BulkEvent>;
    featureOverrides: FeatureOverridesFn;
    rateLimiter: ReturnType<typeof newRateLimiter>;
    offline: boolean;
    configFile?: string;
  };
  private _initialize = once(async () => {
    if (!this._config.offline) {
      await this.getFeaturesCache().refresh();
    }
    this._config.logger?.info("Bucket initialized");
  });

  /**
   * Creates a new SDK client.
   * See README for configuration options.
   *
   * @param options - The options for the client or an existing client to clone.
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
      options.logger === undefined || isObject(options.logger),
      "logger must be an object",
    );
    ok(
      options.httpClient === undefined || isObject(options.httpClient),
      "httpClient must be an object",
    );
    ok(
      options.fallbackFeatures === undefined ||
        Array.isArray(options.fallbackFeatures),
      "fallbackFeatures must be an object",
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

    if (!options.configFile) {
      options.configFile =
        process.env.BUCKET_CONFIG_FILE ?? fs.existsSync(bucketConfigDefaultFile)
          ? bucketConfigDefaultFile
          : undefined;
    }

    const externalConfig = loadConfig(options.configFile);
    const config = mergeSkipUndefined(externalConfig, options);

    const offline = config.offline ?? process.env.NODE_ENV === "test";
    if (!offline) {
      ok(typeof config.secretKey === "string", "secretKey must be a string");
      ok(config.secretKey.length > 22, "invalid secretKey specified");
    }

    // use the supplied logger or apply the log level to the console logger
    const logger = options.logger
      ? options.logger
      : applyLogLevel(
          decorateLogger(BUCKET_LOG_PREFIX, console),
          options.logLevel ?? config?.logLevel ?? "INFO",
        );

    // todo: deprecate fallback features in favour of a more operationally
    //  friendly way of setting fall backs.
    const fallbackFeatures =
      options.fallbackFeatures &&
      options.fallbackFeatures.reduce(
        (acc, key) => {
          acc[key as keyof TypedFeatures] = {
            isEnabled: true,
            key,
          };
          return acc;
        },
        {} as Record<keyof TypedFeatures, RawFeature>,
      );

    this._config = {
      logger,
      offline,
      host: config.host || API_HOST,
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
        ["Authorization"]: `Bearer ${config.secretKey}`,
      },
      rateLimiter: newRateLimiter(FEATURE_EVENT_RATE_LIMITER_WINDOW_SIZE_MS),
      httpClient: options.httpClient || fetchClient,
      refetchInterval: FEATURES_REFETCH_MS,
      staleWarningInterval: FEATURES_REFETCH_MS * 5,
      fallbackFeatures: fallbackFeatures,
      batchBuffer: new BatchBuffer<BulkEvent>({
        ...options?.batchOptions,
        flushHandler: (items) => this.sendBulkEvents(items),
        logger,
      }),
      featureOverrides:
        typeof config.featureOverrides === "function"
          ? config.featureOverrides
          : () => config.featureOverrides,
    };
  }

  /**
   * Gets the logger associated with the client.
   *
   * @returns The logger or `undefined` if it is not set.
   **/
  public get logger() {
    return this._config.logger;
  }

  set featureOverrides(overrides: FeatureOverridesFn) {
    this._config.featureOverrides = overrides;
  }

  /**
   * Returns a new BoundBucketClient with the user/company/otherContext
   * set to be used in subsequent calls.
   * For example, for evaluating feature targeting or tracking events.
   *
   * @param enableTracking
   * @param context - The user/company/otherContext to bind to the client.
   *
   * @returns A new client bound with the arguments given.
   * @throws An error if the user/company is given but their ID is not a string.
   * @remarks
   * The `updateUser` / `updateCompany` methods will automatically be called when
   * the user/company is set respectively.
   **/
  public bindClient({
    enableTracking = true,
    ...context
  }: ContextWithTracking) {
    return new BoundBucketClient(this, { enableTracking, ...context });
  }

  /**
   * Updates the associated user in Bucket.
   *
   * @param opts.attributes - The additional attributes of the company (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @throws An error if the company is not set or the options are invalid.
   * @remarks
   * The company must be set using `withCompany` before calling this method.
   * If the user is set, the company will be associated with the user.
   **/
  public async updateUser(userId: IdType, opts?: TrackOptions) {
    idOk(userId, "userId");
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );
    ok(
      opts?.meta === undefined || isObject(opts.meta),
      "meta must be an object",
    );

    if (this._config.offline) {
      return;
    }

    if (this._config.rateLimiter.isAllowed(hashObject({ ...opts, userId }))) {
      await this._config.batchBuffer.add({
        type: "user",
        userId,
        attributes: opts?.attributes,
        context: opts?.meta,
      });
    }
  }

  /**
   * Updates the associated company in Bucket.
   *
   * @param opts.attributes - The additional attributes of the company (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @throws An error if the company is not set or the options are invalid.
   * @remarks
   * The company must be set using `withCompany` before calling this method.
   * If the user is set, the company will be associated with the user.
   **/
  public async updateCompany(
    companyId: IdType,
    opts?: TrackOptions & { userId?: IdType },
  ) {
    idOk(companyId, "companyId");
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );
    ok(
      opts?.meta === undefined || isObject(opts.meta),
      "meta must be an object",
    );
    if (typeof opts?.userId !== "undefined") {
      idOk(opts?.userId, "userId");
    }

    if (this._config.offline) {
      return;
    }

    if (
      this._config.rateLimiter.isAllowed(hashObject({ ...opts, companyId }))
    ) {
      await this._config.batchBuffer.add({
        type: "company",
        companyId,
        userId: opts?.userId,
        attributes: opts?.attributes,
        context: opts?.meta,
      });
    }
  }

  /**
   * Tracks an event in Bucket.

   * @param event - The event to track.
   * @param userId - The userId of the user who performed the event
   * @param opts
   * @param opts.attributes - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   * @param opts.companyId - Optional company ID for the event (optional).
   *
   * @throws An error if the user is not set or the event is invalid or the options are invalid.
   * @remarks
   * If the company is set, the event will be associated with the company.
   **/
  public async track(
    userId: IdType,
    event: string,
    opts?: TrackOptions & { companyId?: IdType },
  ) {
    idOk(userId, "userId");
    ok(typeof event === "string" && event.length > 0, "event must be a string");
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );
    ok(
      opts?.meta === undefined || isObject(opts.meta),
      "meta must be an object",
    );
    if (opts?.companyId !== undefined) {
      idOk(opts?.companyId, "companyId");
    }

    if (this._config.offline) {
      return;
    }

    await this._config.batchBuffer.add({
      type: "event",
      event,
      companyId: opts?.companyId,
      userId,
      attributes: opts?.attributes,
      context: opts?.meta,
    });
  }

  /**
   * Initializes the client by caching the features definitions.
   *
   * @returns void
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
   * Flushes the batch buffer.
   *
   * @remarks
   * It is recommended to call this method when the application is shutting down to ensure all events are sent
   * before the process exits.
   */
  public async flush() {
    await this._config.batchBuffer.flush();
  }

  /**
   * Gets the evaluated feature for the current context which includes the user, company, and custom context.
   *
   * @param context - The context to evaluate the features for.
   * @returns The evaluated features.
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no features will be returned otherwise.
   **/
  public getFeatures({
    enableTracking = true,
    ...context
  }: ContextWithTracking): TypedFeatures {
    const options = { enableTracking, ...context };
    const features = this._getFeatures(options);
    return Object.fromEntries(
      Object.entries(features).map(([k, v]) => [
        k as keyof TypedFeatures,
        this._wrapRawFeature(options, v),
      ]),
    );
  }

  /**
   * Gets the evaluated feature for the current context which includes the user, company, and custom context.
   * Using the `isEnabled` property sends a `check` event to Bucket.
   *
   * @returns The evaluated features.
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no features will be returned otherwise.
   **/
  public getFeature(
    { enableTracking = true, ...context }: ContextWithTracking,
    key: keyof TypedFeatures,
  ) {
    const options = { enableTracking, ...context };
    const features = this._getFeatures(options);
    const feature = features[key];

    return this._wrapRawFeature(options, {
      key,
      isEnabled: feature?.isEnabled ?? false,
      targetingVersion: feature?.targetingVersion,
    });
  }

  /**
   * Gets evaluated features with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param userId
   * @param companyId
   * @param additionalContext
   * @returns evaluated features
   */
  public async getFeaturesRemote(
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<TypedFeatures> {
    return await this._getFeaturesRemote(
      "",
      userId,
      companyId,
      additionalContext,
    );
  }

  /**
   * Gets evaluated feature with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param key
   * @param userId
   * @param companyId
   * @param additionalContext
   * @returns evaluated feature
   */
  public async getFeatureRemote(
    key: string,
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<Feature> {
    const features = await this._getFeaturesRemote(
      key,
      userId,
      companyId,
      additionalContext,
    );
    return features[key];
  }

  /**
   * Sends a POST request to the specified path.
   *
   * @param path - The path to send the request to.
   * @param body - The body of the request.
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the path or body is invalid.
   **/
  private async post<TBody>(path: string, body: TBody) {
    ok(typeof path === "string" && path.length > 0, "path must be a string");
    ok(typeof body === "object", "body must be an object");

    const url = `${this._config.host}/${path}`;
    try {
      const response = await this._config.httpClient.post<
        TBody,
        { success: boolean }
      >(url, this._config.headers, body);
      this._config.logger?.debug(`post request to "${url}"`, response);

      if (!isObject(response.body) || response.body.success !== true) {
        this._config.logger?.warn(
          `invalid response received from server for "${url}"`,
          response,
        );
        return false;
      }
      return true;
    } catch (error) {
      this._config.logger?.error(
        `post request to "${url}" failed with error`,
        error,
      );
      return false;
    }
  }

  /**
   * Sends a GET request to the specified path.
   *
   * @param path - The path to send the request to.
   * @returns The response from the server.
   * @throws An error if the path is invalid.
   **/
  private async get<TResponse>(path: string) {
    ok(typeof path === "string" && path.length > 0, "path must be a string");

    try {
      const url = `${this._config.host}/${path}`;
      const response = await this._config.httpClient.get<
        TResponse & { success: boolean }
      >(url, this._config.headers);

      this._config.logger?.debug(`get request to "${url}"`, response);

      if (!isObject(response.body) || !response.body.success) {
        this._config.logger?.warn(
          `invalid response received from server for "${url}"`,
          response,
        );

        return undefined;
      }

      const { success: _, ...result } = response.body;
      return result as TResponse;
    } catch (error) {
      this._config.logger?.error(
        `get request to "${path}" failed with error`,
        error,
      );
      return undefined;
    }
  }

  /**
   * Sends a batch of events to the Bucket API.
   * @param events - The events to send.
   * @throws An error if the the send fails.
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
   * Sends a feature event to the Bucket API.
   *
   * Feature events are used to track the evaluation of feature targeting rules.
   * "check" events are sent when a feature's `isEnabled` property is checked.
   * "evaluate" events are sent when a feature's targeting rules are matched against
   * the current context.
   *
   * @param event - The event to send.
   *
   * @throws An error if the event is invalid.
   *
   * @remarks
   * This method is rate-limited to prevent too many events from being sent.
   **/
  private async sendFeatureEvent(event: FeatureEvent) {
    ok(typeof event === "object", "event must be an object");
    ok(
      typeof event.action === "string" &&
        (event.action === "evaluate" || event.action === "check"),
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
      typeof event.evalResult === "boolean",
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
      !this._config.rateLimiter.isAllowed(
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

    await this._config.batchBuffer.add({
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
   * Updates the context in Bucket (if needed).
   * This method should be used before requesting feature flags or binding a client.
   *
   * @param options
   */
  private async syncContext(options: { enableTracking: boolean } & Context) {
    if (!options.enableTracking) {
      this._config.logger?.debug(
        "tracking disabled, not updating user/company",
      );

      return;
    }

    const promises: Promise<void>[] = [];
    if (typeof options.company?.id !== "undefined") {
      const { id: _, ...attributes } = options.company;
      promises.push(
        this.updateCompany(options.company.id, {
          attributes,
          meta: { active: false },
        }),
      );
    }

    if (typeof options.user?.id !== "undefined") {
      const { id: _, ...attributes } = options.user;
      promises.push(
        this.updateUser(options.user.id, {
          attributes,
          meta: { active: false },
        }),
      );
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * Gets the features cache.
   *
   * @returns The features cache.
   **/
  private getFeaturesCache() {
    if (!this._config.featuresCache) {
      this._config.featuresCache = cache<FeaturesAPIResponse>(
        this._config.refetchInterval,
        this._config.staleWarningInterval,
        this._config.logger,
        async () => {
          const res = await this.get<FeaturesAPIResponse>("features");

          if (!isObject(res) || !Array.isArray(res?.features)) {
            return undefined;
          }

          return res;
        },
      );
    }

    return this._config.featuresCache;
  }

  private _getFeatures(
    options: { enableTracking: boolean } & Context,
  ): Record<string, RawFeature> {
    checkContextWithTracking(options);

    void this.syncContext(options);
    let featureDefinitions: FeaturesAPIResponse["features"];

    if (this._config.offline) {
      featureDefinitions = [];
    } else {
      const fetchedFeatures = this.getFeaturesCache().get();
      if (!fetchedFeatures) {
        this._config.logger?.warn(
          "failed to use feature definitions, there are none cached yet. Using fallback features.",
        );
        return this._config.fallbackFeatures || {};
      }

      featureDefinitions = fetchedFeatures.features;
    }

    const keyToVersionMap = new Map<string, number>(
      featureDefinitions.map((f) => [f.key, f.targeting.version]),
    );

    const { enableTracking = true, ...context } = options;

    const evaluated = featureDefinitions.map((feature) =>
      evaluateFeatureRules({
        featureKey: feature.key,
        rules: feature.targeting.rules.map((r) => ({ ...r, value: true })),
        context,
      }),
    );

    if (enableTracking) {
      evaluated.forEach(async (res) => {
        try {
          await this.sendFeatureEvent({
            action: "evaluate",
            key: res.featureKey,
            targetingVersion: keyToVersionMap.get(res.featureKey),
            evalResult: res.value ?? false,
            evalContext: res.context,
            evalRuleResults: res.ruleEvaluationResults,
            evalMissingFields: res.missingContextFields,
          });
        } catch (err) {
          this._config.logger?.error(
            `failed to send evaluate event for "${res.featureKey}"`,
            err,
          );
        }
      });
    }

    let evaluatedFeatures = evaluated.reduce(
      (acc, res) => {
        acc[res.featureKey as keyof TypedFeatures] = {
          key: res.featureKey,
          isEnabled: res.value ?? false,
          targetingVersion: keyToVersionMap.get(res.featureKey),
        };
        return acc;
      },
      {} as Record<keyof TypedFeatures, RawFeature>,
    );

    // apply feature overrides
    const overrides = Object.entries(
      this._config.featureOverrides(context),
    ).map(([key, isEnabled]) => [key, { key, isEnabled }]);

    if (overrides.length > 0) {
      // merge overrides into evaluated features
      evaluatedFeatures = {
        ...evaluatedFeatures,
        ...Object.fromEntries(overrides),
      };
    }
    this._config.logger?.debug("evaluated features", evaluatedFeatures);

    return evaluatedFeatures;
  }

  private _wrapRawFeature(
    options: { enableTracking: boolean } & Context,
    { key, isEnabled, targetingVersion }: RawFeature,
  ): Feature {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const client = this;

    return {
      get isEnabled() {
        if (options.enableTracking) {
          void client
            .sendFeatureEvent({
              action: "check",
              key,
              targetingVersion,
              evalResult: isEnabled,
            })
            .catch((err) => {
              client._config.logger?.error(
                `failed to send check event for "${key}": ${err}`,
                err,
              );
            });
        }

        return isEnabled;
      },
      key,
      track: async () => {
        if (typeof options.user?.id === "undefined") {
          this._config.logger?.warn("no user set, cannot track event");
          return;
        }

        if (options.enableTracking) {
          await this.track(options.user.id, key, {
            companyId: options.company?.id,
          });
        } else {
          this._config.logger?.debug("tracking disabled, not tracking event");
        }
      },
    };
  }

  private async _getFeaturesRemote(
    key: string,
    userId?: IdType,
    companyId?: IdType,
    additionalContext?: Context,
  ): Promise<TypedFeatures> {
    const context = additionalContext || {};
    if (userId) {
      context.user = { id: userId };
    }
    if (companyId) {
      context.company = { id: companyId };
    }

    const contextWithTracking = {
      ...context,
      enableTracking: true,
    };
    checkContextWithTracking(contextWithTracking);

    const params = new URLSearchParams(flattenJSON({ context }));
    if (key) {
      params.append("key", key);
    }

    const res = await this.get<EvaluatedFeaturesAPIResponse>(
      "features/evaluated?" + params.toString(),
    );

    if (res) {
      return Object.fromEntries(
        Object.entries(res.features).map(([featureKey, feature]) => {
          return [
            featureKey as keyof TypedFeatures,
            this._wrapRawFeature(contextWithTracking, feature),
          ];
        }) || [],
      );
    } else {
      this._config.logger?.error("failed to fetch evaluated features");
      return {};
    }
  }
}

/**
 * A client bound with a specific user, company, and other context.
 */
export class BoundBucketClient {
  private _client: BucketClient;
  private _options: ContextWithTracking;

  constructor(
    client: BucketClient,
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
   * Get features for the user/company/other context bound to this client.
   * Meant for use in serialization of features for transferring to the client-side/browser.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeatures() {
    return this._client.getFeatures(this._options);
  }

  /**
   * Get a specific feature for the user/company/other context bound to this client.
   * Using the `isEnabled` property sends a `check` event to Bucket.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeature(key: keyof TypedFeatures) {
    return this._client.getFeature(this._options, key);
  }

  /**
   * Get remotely evaluated feature for the user/company/other context bound to this client.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public async getFeaturesRemote() {
    return await this._client.getFeaturesRemote(
      this._options.user?.id,
      this._options.company?.id,
      this._options,
    );
  }

  /**
   * Get remotely evaluated feature for the user/company/other context bound to this client.
   *
   * @param key
   * @returns Feature for the given user/company and key and whether it's enabled or not
   */
  public async getFeatureRemote(key: string) {
    return await this._client.getFeatureRemote(
      key,
      this._options.user?.id,
      this._options.company?.id,
      this._options,
    );
  }

  /**
   * Track an event in Bucket.
   *
   * @param event - The event to track.
   * @param opts
   * @param opts.attributes - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   * @param opts.companyId - Optional company ID for the event (optional).
   *
   * @throws An error if the event is invalid or the options are invalid.
   */
  public async track(
    event: string,
    opts?: TrackOptions & { companyId?: string },
  ) {
    ok(opts === undefined || isObject(opts), "opts must be an object");

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
      opts?.companyId
        ? opts
        : { ...opts, companyId: this._options.company?.id },
    );
  }

  /**
   * Create a new client bound with the additional context.
   * Note: This performs a shallow merge for user/company/other individually.
   *
   * @param context User/company/other context to bind to the client object
   * @returns new client bound with the additional context
   */
  public bindClient({
    user,
    company,
    other,
    enableTracking,
  }: Context & { enableTracking?: boolean }) {
    // merge new context into existing
    const boundConfig = {
      ...this._options,
      user: user ? { ...this._options.user, ...user } : undefined,
      company: company ? { ...this._options.company, ...company } : undefined,
      other: { ...this._options.other, ...other },
      enableTracking: enableTracking ?? this._options.enableTracking,
    };

    return new BoundBucketClient(this._client, boundConfig);
  }

  /**
   * Flushes the batch buffer.
   */
  public async flush() {
    await this._client.flush();
  }
}

function checkContextWithTracking(
  context: ContextWithTracking,
): asserts context is ContextWithTracking & { enableTracking: boolean } {
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
  ok(
    typeof context.enableTracking === "boolean",
    "enableTracking must be a boolean",
  );
}
