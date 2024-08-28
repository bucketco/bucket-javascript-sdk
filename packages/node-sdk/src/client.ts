import { evaluateTargeting, flattenJSON } from "@bucketco/flag-evaluation";

import cache from "./cache";
import {
  API_HOST,
  BUCKET_LOG_PREFIX,
  FEATURE_EVENTS_PER_MIN,
  FEATURES_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "./config";
import fetchClient from "./fetch-http-client";
import {
  Cache,
  ClientOptions,
  Context,
  FeatureEvent,
  FeaturesAPIResponse,
  HttpClient,
  InternalFeature,
  Logger,
  TrackOptions,
  TypedFeatures,
} from "./types";
import {
  checkWithinAllottedTimeWindow,
  decorateLogger,
  isObject,
  maskedProxy,
  ok,
} from "./utils";

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
    fallbackFeatures?: Record<keyof TypedFeatures, InternalFeature>;
    featuresCache?: Cache<FeaturesAPIResponse>;
  };

  /**
   * Creates a new SDK client.
   *
   * @param options - The options for the client or an existing client to clone.
   * @throws An error if the options are invalid.
   **/
  constructor(options: ClientOptions) {
    ok(isObject(options), "options must be an object");
    ok(
      typeof options.secretKey === "string" && options.secretKey.length > 22,
      "secretKey must be a string",
    );
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

    const features =
      options.fallbackFeatures &&
      options.fallbackFeatures.reduce(
        (acc, key) => {
          acc[key as keyof TypedFeatures] = {
            isEnabled: true,
            key,
          };
          return acc;
        },
        {} as Record<keyof TypedFeatures, InternalFeature>,
      );

    this._config = {
      logger:
        options.logger && decorateLogger(BUCKET_LOG_PREFIX, options.logger),
      host: options.host || API_HOST,
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
        ["Authorization"]: `Bearer ${options.secretKey}`,
      },
      httpClient: options.httpClient || fetchClient,
      refetchInterval: FEATURES_REFETCH_MS,
      staleWarningInterval: FEATURES_REFETCH_MS * 5,
      fallbackFeatures: features,
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

    try {
      const response = await this._config.httpClient.post<
        TBody,
        { success: boolean }
      >(`${this._config.host}/${path}`, this._config.headers, body);

      this._config.logger?.debug(`post request to "${path}"`, response);
      return response.body?.success === true;
    } catch (error) {
      this._config.logger?.error(
        `post request to "${path}" failed with error`,
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
      const response = await this._config.httpClient.get<
        TResponse & { success: boolean }
      >(`${this._config.host}/${path}`, this._config.headers);

      this._config.logger?.debug(`get request to "${path}"`, response);

      if (!isObject(response.body) || response.body.success !== true) {
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
   * Sends a feature event to the Bucket API.
   *
   * Feature events are used to track the evaluation of feature targeting rules.
   * "check" events are sent when a feature's `isEnabled` property is checked.
   * "evaluate" events are sent when a feature's targeting rules are matched against
   * the current context.
   *
   * @param event - The event to send.
   *
   * @returns A boolean indicating if the request was successful.
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
      !checkWithinAllottedTimeWindow(
        FEATURE_EVENTS_PER_MIN,
        `${event.action}:${contextKey}:${event.key}:${event.targetingVersion}:${event.evalResult}`,
      )
    ) {
      return false;
    }

    return await this.post("features/events", {
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

    // TODO: batch these updates and send to the bulk endpoint
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
   * @returns A boolean indicating if the request was successful.
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

    return await this.post("user", {
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
   * @returns A boolean indicating if the request was successful.
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

    return await this.post("company", {
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
   * @returns A boolean indicating if the request was successful.
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

    return await this.post("event", {
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
   * Gets the evaluated feature for the current context which includes the user, company, and custom context.
   *
   * @returns The evaluated features.
   * @remarks
   * Call `initialize` before calling this method to ensure the feature definitions are cached, no features will be returned otherwise.
   **/
  public getFeatures(context: Context): TypedFeatures {
    const featureDefinitions = this.getFeaturesCache().get();
    let evaluatedFeatures: Record<keyof TypedFeatures, InternalFeature> =
      this._config.fallbackFeatures || {};

    if (featureDefinitions) {
      const keyToVersionMap = new Map<string, number>(
        featureDefinitions.features.map((f) => [f.key, f.targeting.version]),
      );

      const evaluated = featureDefinitions.features.map((feature) =>
        evaluateTargeting({ context, feature }),
      );

      // TODO: use the bulk endpoint
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

      evaluatedFeatures = evaluated
        .filter((e) => e.value)
        .reduce(
          (acc, res) => {
            acc[res.feature.key as keyof TypedFeatures] = {
              key: res.feature.key,
              isEnabled: res.value,
              targetingVersion: keyToVersionMap.get(res.feature.key),
            };
            return acc;
          },
          {} as Record<keyof TypedFeatures, InternalFeature>,
        );

      this._config.logger?.debug("evaluated features", evaluatedFeatures);
    } else {
      this._config.logger?.warn(
        "failed to use feature definitions, there are none cached yet. Using fallback features.",
      );
    }

    return maskedProxy(evaluatedFeatures, (features, key) => {
      void this.sendFeatureEvent({
        action: "check",
        key: key,
        targetingVersion: features[key].targetingVersion,
        evalResult: features[key].isEnabled,
      }).catch((err) => {
        this._config.logger?.error(
          `failed to send check event for "${key}": ${err}`,
          err,
        );
      });

      const feature = features[key];

      return {
        key,
        isEnabled: feature?.isEnabled ?? false,
        track: async () => {
          const userId = context.user?.id;
          if (!userId) {
            this._config.logger?.warn(
              "feature.track(): no user set, cannot track event",
            );
            return;
          }

          await this.track(userId, key);
        },
      };
    });
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
   *
   * @returns Features for the given user/company and whether each one is enabled or not
   */
  public getFeatures() {
    return this._client.getFeatures(this._context);
  }

  /**
   * Track an event in Bucket.
   *
   * @param event - The event to track.
   * @param opts.attributes - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the event is invalid or the options are invalid.
   */
  public async track(
    event: string,
    opts?: TrackOptions & { companyId?: string },
  ) {
    const userId = this._context.user?.id;

    if (!userId) {
      this._client.logger?.warn("No user set, cannot track event");
      return false;
    }

    return await this._client.track(userId, event, opts);
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
}
