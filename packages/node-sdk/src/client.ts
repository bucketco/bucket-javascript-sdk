import fs from "fs";

import { evaluateTargeting, flattenJSON } from "@bucketco/flag-evaluation";

import BatchBuffer from "./batch-buffer";
import cache from "./cache";
import {
  API_HOST,
  applyLogLevel,
  BUCKET_LOG_PREFIX,
  FEATURE_EVENT_RATE_LIMITER_WINDOW_SIZE_MS,
  FEATURES_REFETCH_MS,
  loadConfig,
  LogLevel,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "./config";
import fetchClient from "./fetch-http-client";
import { newRateLimiter } from "./rate-limiter";
import type {
  EvaluatedFeaturesAPIResponse,
  FeatureOverridesFn,
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
import { decorateLogger, isObject, mergeSkipUndefined, ok } from "./utils";

const bucketConfigDefaultFile = "bucketConfig.json";

type BulkEvent =
  | {
      type: "company";
      companyId: string;
      userId?: string;
      attributes?: Attributes;
      context?: TrackingMeta;
    }
  | {
      type: "user";
      userId: string;
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
      companyId?: string;
      userId: string;
      attributes?: Attributes;
      context?: TrackingMeta;
    };

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
    // always decorate the logger with the bucket log prefix
    const logger = decorateLogger(
      BUCKET_LOG_PREFIX,
      options.logger
        ? options.logger
        : applyLogLevel(
            console,
            options.logLevel ?? config?.logLevel ?? "INFO",
          ),
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

      if (!isObject(response.body) || response.body.success !== true) {
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

    if (this._config.offline) {
      return;
    }

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

    if (
      !this._config.rateLimiter.isAllowed(
        `${event.action}:${contextKey}:${event.key}:${event.targetingVersion}:${event.evalResult}`,
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

  private getFeaturesCache() {
    if (!this._config.featuresCache) {
      this._config.featuresCache = cache<FeaturesAPIResponse>(
        this._config.refetchInterval,
        this._config.staleWarningInterval,
        this._config.logger,
        async () => {
          if (this._config.offline) {
            return { features: [] };
          }
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

  /**
   * Gets the logger associated with the client.
   *
   * @returns The logger or `undefined` if it is not set.
   **/
  public get logger() {
    return this._config.logger;
  }

  /**
   * Returns a new BoundBucketClient with the user/company/otherContext
   * set to be used in subsequent calls.
   * For example, for evaluating feature targeting or tracking events.
   *
   * @param context - The user/company/otherContext to bind to the client.
   *
   * @returns A new client bound with the arguments given.
   * @throws An error if the user/company is given but their ID is not a string.
   * @remarks
   * The `updateUser` / `updateCompany` methods will automatically be called when
   * the user/company is set respectively.
   **/
  public bindClient(context: Context) {
    const boundClient = new BoundBucketClient(this, context);

    if (context.company) {
      const { id: _, ...attributes } = context.company;
      void this.updateCompany(context.company.id, {
        attributes,
        meta: { active: false },
      });
    }

    if (context.user) {
      const { id: _, ...attributes } = context.user;
      void this.updateUser(context.user.id, {
        attributes,
        meta: { active: false },
      });
    }

    return boundClient;
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
  public async updateUser(userId: string, opts?: TrackOptions) {
    ok(
      typeof userId === "string" && userId.length > 0,
      "companyId must be a string",
    );
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );
    ok(
      opts?.meta === undefined || isObject(opts.meta),
      "meta must be an object",
    );

    await this._config.batchBuffer.add({
      type: "user",
      userId,
      attributes: opts?.attributes,
      context: opts?.meta,
    });
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
    companyId: string,
    opts: TrackOptions & { userId?: string },
  ) {
    ok(
      typeof companyId === "string" && companyId.length > 0,
      "companyId must be a string",
    );
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );
    ok(
      opts?.meta === undefined || isObject(opts.meta),
      "meta must be an object",
    );
    ok(
      opts?.userId === undefined || typeof opts.userId === "string",
      "userId must be a string",
    );

    await this._config.batchBuffer.add({
      type: "company",
      companyId,
      userId: opts?.userId,
      attributes: opts?.attributes,
      context: opts?.meta,
    });
  }

  /**
   * Tracks an event in Bucket.
   
   * @param event - The event to track.
   * @param userId - The userId of the user who performed the event
   * @param opts.attributes - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   * @param opts.companyId - Optional company ID for the event (optional).
   *
   * @throws An error if the user is not set or the event is invalid or the options are invalid.
   * @remarks
   * If the company is set, the event will be associated with the company.
   **/
  public async track(
    userId: string,
    event: string,
    opts?: TrackOptions & { companyId?: string },
  ) {
    ok(
      typeof userId === "string" && userId.length > 0,
      "userId must be a string",
    );
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
    ok(
      opts?.companyId === undefined || typeof opts.companyId === "string",
      "companyId must be an string",
    );

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
   **/
  public async initialize() {
    await this.getFeaturesCache().refresh();
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

  private _getFeatures(context: Context): Record<string, RawFeature> {
    const featureDefinitions = this.getFeaturesCache().get();
    let evaluatedFeatures: Record<keyof TypedFeatures, RawFeature> =
      this._config.fallbackFeatures || {};

    if (featureDefinitions) {
      const keyToVersionMap = new Map<string, number>(
        featureDefinitions.features.map((f) => [f.key, f.targeting.version]),
      );

      const evaluated = featureDefinitions.features.map((feature) =>
        evaluateTargeting({ context, feature }),
      );

      evaluated.forEach(async (res) => {
        this.sendFeatureEvent({
          action: "evaluate",
          key: res.feature.key,
          targetingVersion: keyToVersionMap.get(res.feature.key),
          evalResult: res.value,
          evalContext: res.context,
          evalRuleResults: res.ruleEvaluationResults,
          evalMissingFields: res.missingContextFields,
        }).catch((err) => {
          this._config.logger?.error(
            `failed to send evaluate event for "${res.feature.key}"`,
            err,
          );
        });
      });

      evaluatedFeatures = evaluated.reduce(
        (acc, res) => {
          acc[res.feature.key as keyof TypedFeatures] = {
            key: res.feature.key,
            isEnabled: res.value,
            targetingVersion: keyToVersionMap.get(res.feature.key),
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
    } else {
      this._config.logger?.warn(
        "failed to use feature definitions, there are none cached yet. Using fallback features.",
      );
    }
    return evaluatedFeatures;
  }

  private _wrapRawFeature(
    context: Context,
    { key, isEnabled, targetingVersion }: RawFeature,
  ): Feature {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const client = this;

    return {
      get isEnabled() {
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

        return isEnabled;
      },
      key,
      track: async () => {
        const userId = context.user?.id;
        if (!userId) {
          this._config.logger?.warn(
            "feature.track(): no user set, cannot track event",
          );
          return;
        }

        await this.track(userId, key, {
          companyId: context.company?.id,
        });
      },
    };
  }

  /**
   * Gets the evaluated feature for the current context which includes the user, company, and custom context.
   *
   * @returns The evaluated features.
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no features will be returned otherwise.
   **/
  public getFeatures(context: Context): TypedFeatures {
    const features = this._getFeatures(context);
    return Object.fromEntries(
      Object.entries(features).map(([k, v]) => [
        k as keyof TypedFeatures,
        this._wrapRawFeature(context, v),
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
  public getFeature(context: Context, key: keyof TypedFeatures) {
    const features = this._getFeatures(context);
    const feature = features[key];

    return this._wrapRawFeature(context, {
      key,
      isEnabled: feature?.isEnabled ?? false,
      targetingVersion: feature?.targetingVersion,
    });
  }

  set featureOverrides(overrides: FeatureOverridesFn) {
    this._config.featureOverrides = overrides;
  }

  private async _getFeaturesRemote(
    key: string,
    userId?: string,
    companyId?: string,
    additionalContext?: Context,
  ): Promise<TypedFeatures> {
    const context = additionalContext || {};
    if (userId) {
      context.user = { id: userId };
    }
    if (companyId) {
      context.company = { id: companyId };
    }

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
            this._wrapRawFeature(context, feature),
          ];
        }) || [],
      );
    } else {
      this._config.logger?.error("failed to fetch evaluated features");
      return {};
    }
  }

  /**
   * Gets evaluated features with the usage of remote context.
   * This method triggers a network request every time it's called.
   *
   * @param additionalContext
   * @returns evaluated features
   */
  public async getFeaturesRemote(
    userId?: string,
    companyId?: string,
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
    userId?: string,
    companyId?: string,
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
}

/**
 * A client bound with a specific user, company, and other context.
 */
export class BoundBucketClient {
  private _client: BucketClient;
  private _context: Context;

  constructor(client: BucketClient, context: Context) {
    this._client = client;

    this._context = context;
    this.checkContext(context);
  }

  private checkContext(context: Context) {
    ok(isObject(context), "context must be an object");
    ok(
      context.user === undefined || typeof context.user?.id === "string",
      "user.id must be a string if user is given",
    );
    ok(
      context.company === undefined || typeof context.company?.id === "string",
      "company.id must be a string if company is given",
    );
    ok(
      context.other === undefined || isObject(context.other),
      "other must be an object if given",
    );
  }

  /**
   * Gets the "other" context associated with the client.
   *
   * @returns The "other" context or `undefined` if it is not set.
   **/
  public get otherContext() {
    return this._context.other;
  }

  /**
   * Gets the user associated with the client.
   *
   * @returns The user or `undefined` if it is not set.
   **/
  public get user() {
    return this._context.user;
  }

  /**
   * Gets the company associated with the client.
   *
   * @returns The company or `undefined` if it is not set.
   **/
  public get company() {
    return this._context.company;
  }

  /**
   * Get features for the user/company/other context bound to this client.
   * Meant for use in serialization of features for transferring to the client-side/browser.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeatures() {
    return this._client.getFeatures(this._context);
  }

  /**
   * Get a specific feature for the user/company/other context bound to this client.
   * Using the `isEnabled` property sends a `check` event to Bucket.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeature(key: keyof TypedFeatures) {
    return this._client.getFeature(this._context, key);
  }

  /**
   * Get remotely evaluated feature for the user/company/other context bound to this client.
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public async getFeaturesRemote() {
    return await this._client.getFeaturesRemote(
      this._context.user?.id,
      this._context.company?.id,
      this._context,
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
      this._context.user?.id,
      this._context.company?.id,
      this._context,
    );
  }

  /**
   * Track an event in Bucket.
   *
   * @param event - The event to track.
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

    const userId = this._context.user?.id;

    if (!userId) {
      this._client.logger?.warn("no user set, cannot track event");
      return;
    }

    await this._client.track(
      userId,
      event,
      opts?.companyId
        ? opts
        : { ...opts, companyId: this._context.company?.id },
    );
  }

  /**
   * Create a new client bound with the additional context.
   * Note: This performs a shallow merge for user/company/other individually.
   *
   * @param context User/company/other context to bind to the client object
   * @returns new client bound with the additional context
   */
  public bindClient({ user, company, other }: Context) {
    // merge new context into existing
    const newContext = {
      ...this._context,
      user: user ? { ...this._context.user, ...user } : undefined,
      company: company ? { ...this._context.company, ...company } : undefined,
      other: { ...this._context.other, ...other },
    };

    return new BoundBucketClient(this._client, newContext);
  }

  /**
   * Flushes the batch buffer.
   */
  public async flush() {
    await this._client.flush();
  }
}
