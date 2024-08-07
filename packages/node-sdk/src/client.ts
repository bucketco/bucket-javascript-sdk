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
  Attributes,
  BucketClient as BucketClientType,
  Cache,
  ClientOptions,
  Feature,
  FeatureEvent,
  FeaturesAPIResponse,
  HttpClient,
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
 * Creates a new SDK client.
 *
 * @remarks
 * The client is used to interact with the Bucket API.
 * Use the client to track users, companies, events, and feature usage and determine which features should be enabled.
 */
export function BucketClient(options: ClientOptions) {
  return new BucketClientClass(options) as BucketClientType;
}

/**
 * The SDK client.
 *
 **/
export class BucketClientClass {
  private _shared: {
    logger?: Logger;
    host: string;
    httpClient: HttpClient;
    refetchInterval: number;
    staleWarningInterval: number;
    headers: Record<string, string>;
    fallbackFeatures?: Record<keyof TypedFeatures, Feature>;
    featuresCache?: Cache<FeaturesAPIResponse>;
  };

  private _otherContext: Record<string, any> | undefined;
  private _company: { companyId: string; attrs?: Attributes } | undefined;
  private _user: { userId: string; attrs?: Attributes } | undefined;

  /**
   * Creates a new SDK client.
   *
   * @param options - The options for the client.
   * @throws An error if the options are invalid.
   **/
  constructor(options: ClientOptions);

  /**
   * Creates a new SDK client.
   *
   * @param client - An existing client to clone.
   * @throws An error if the client is invalid.
   **/
  constructor(client: BucketClientClass);

  /**
   * Creates a new SDK client.
   *
   * @param options - The options for the client or an existing client to clone.
   * @throws An error if the options are invalid.
   **/
  constructor(options: ClientOptions | BucketClientClass) {
    if (options instanceof BucketClientClass) {
      this._shared = options._shared;
      this._otherContext = options._otherContext;
      this._company = options._company;
      this._user = options._user;

      return;
    }

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
        isObject(options.fallbackFeatures),
      "fallbackFeatures must be an object",
    );

    const features =
      options.fallbackFeatures &&
      Object.entries(options.fallbackFeatures).reduce(
        (acc, [key, isEnabled]) => {
          acc[key as keyof TypedFeatures] = {
            key,
            isEnabled,
          };
          return acc;
        },
        {} as Record<keyof TypedFeatures, Feature>,
      );

    this._shared = {
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
      const response = await this._shared.httpClient.post<
        TBody,
        { success: boolean }
      >(`${this._shared.host}/${path}`, this._shared.headers, body);

      this._shared.logger?.debug(`post request to "${path}"`, response);
      return response.body?.success === true;
    } catch (error) {
      this._shared.logger?.error(
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
      const response = await this._shared.httpClient.get<
        TResponse & { success: boolean }
      >(`${this._shared.host}/${path}`, this._shared.headers);

      this._shared.logger?.debug(`get request to "${path}"`, response);

      if (!isObject(response.body) || response.body.success !== true) {
        return undefined;
      }

      const { success: _, ...result } = response.body;
      return result as TResponse;
    } catch (error) {
      this._shared.logger?.error(
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
    if (!this._shared.featuresCache) {
      this._shared.featuresCache = cache<FeaturesAPIResponse>(
        this._shared.refetchInterval,
        this._shared.staleWarningInterval,
        this._shared.logger,
        async () => {
          const res = await this.get<FeaturesAPIResponse>("features");

          if (!isObject(res) || !Array.isArray(res?.features)) {
            return undefined;
          }

          return res;
        },
      );
    }

    return this._shared.featuresCache;
  }

  /**
   * Sets the user that is used for targeting evaluation.
   *
   * @param userId - The user ID to set.
   * @param attributes - The attributes of the user (optional).
   *
   * @returns A new client with the user set.
   * @throws An error if the user ID is not a string or the options are invalid.
   * @remarks
   * If the user ID is the same as the current company, the attributes will be merged, and
   * the new attributes will take precedence.
   *
   * The `updateUser` method will automatically be called after setting the user.
   **/
  public withUser(userId: string, attributes?: Attributes): BucketClientClass {
    ok(
      typeof userId === "string" && userId.length > 0,
      "userId must be a string",
    );
    ok(
      attributes === undefined || isObject(attributes),
      "attributes must be an object",
    );

    const client = new BucketClientClass(this);
    if (userId !== this._user?.userId) {
      client._user = { userId, attrs: attributes };
    } else {
      client._user = {
        userId: this._user.userId,
        attrs: { ...this._user.attrs, ...attributes },
      };
    }

    void client.updateUser();

    return client;
  }

  /**
   * Sets the company that is used for feature targeting evaluation.
   *
   * @param companyId - The company ID to set.
   * @param attributes - The attributes of the user (optional).
   *
   * @returns A new client with the company set.
   * @throws An error if the company ID is not a string or the options are invalid.
   * @remarks
   * If the company ID is the same as the current company, the attributes will be merged, and
   * the new attributes will take precedence.
   *
   * The `updateCompany` method will automatically be called after setting the company.
   **/
  public withCompany(
    companyId: string,
    attributes?: Attributes,
  ): BucketClientClass {
    ok(
      typeof companyId === "string" && companyId.length > 0,
      "companyId must be a string",
    );
    ok(
      attributes === undefined || isObject(attributes),
      "attributes must be an object",
    );

    const client = new BucketClientClass(this);
    if (companyId !== this._company?.companyId) {
      client._company = { companyId, attrs: attributes };
    } else {
      client._company = {
        companyId: this._company.companyId,
        attrs: { ...this._company.attrs, ...attributes },
      };
    }

    void client.updateCompany();

    return client;
  }

  /**
   * Sets the extra, custom context for the client.
   *
   * @param context - The "extra" context to set.
   *
   * @returns A new client with the context set.
   * @throws An error if the context is not an object or the options are invalid.
   **/
  public withOtherContext(context: Record<string, any>): BucketClientClass {
    ok(isObject(context), "context must be an object");

    const client = new BucketClientClass(this);

    client._otherContext = context;

    return client;
  }

  /**
   * Gets the extra, custom context associated with the client.
   *
   * @returns The extra, custom context or `undefined` if it is not set.
   **/
  public get otherContext() {
    return this._otherContext;
  }

  /**
   * Gets the user associated with the client.
   *
   * @returns The user or `undefined` if it is not set.
   **/
  public get user() {
    return this._user;
  }

  /**
   * Gets the company associated with the client.
   *
   * @returns The company or `undefined` if it is not set.
   **/
  public get company() {
    return this._company;
  }

  /**
   * Updates a user in Bucket.
   *
   * @param opts.attributes - The additional attributes of the user (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the user is not set or the options are invalid.
   * @remarks
   * The user must be set using `withUser` before calling this method.
   **/
  public async updateUser(opts?: TrackOptions) {
    ok(isObject(this._user), "user must be set");
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
      userId: this._user.userId,
      attributes: { ...this._user.attrs, ...opts?.attributes },
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
  public async updateCompany(opts?: TrackOptions) {
    ok(isObject(this._company), "company must be set");
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
      companyId: this._company.companyId,
      userId: this._user?.userId,
      attributes: { ...this._company.attrs, ...opts?.attributes },
      context: opts?.meta,
    });
  }

  /**
   * Tracks an event in Bucket.
   *
   * @param event - The event to track.
   * @param opts.attributes - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the user is not set or the event is invalid or the options are invalid.
   * @remarks
   * If the company is set, the event will be associated with the company.
   **/
  public async trackFeatureUsage(event: string, opts?: TrackOptions) {
    ok(isObject(this._user), "user must be set");
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

    return await this.post("event", {
      event,
      companyId: this._company?.companyId,
      userId: this._user?.userId,
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
  public getFeatures(): Readonly<TypedFeatures> {
    const mergedContext = {
      user: this._user && {
        id: this._user.userId,
        ...this._user.attrs,
      },
      company: this._company && {
        id: this._company.companyId,
        ...this._company.attrs,
      },
      other: this._otherContext,
    };

    const featureDefinitions = this.getFeaturesCache().get();
    let evaluatedFeatures: Record<keyof TypedFeatures, Feature> =
      this._shared.fallbackFeatures || {};

    if (featureDefinitions) {
      const keyToVersionMap = new Map<string, number>(
        featureDefinitions.features.map((f) => [f.key, f.targeting.version]),
      );

      const evaluated = featureDefinitions.features.map((feature) =>
        evaluateTargeting({ context: mergedContext, feature }),
      );

      evaluated.forEach(async (res) => {
        await this.sendFeatureEvent({
          action: "evaluate",
          key: res.feature.key,
          targetingVersion: keyToVersionMap.get(res.feature.key),
          evalResult: res.value,
          evalContext: res.context,
          evalRuleResults: res.ruleEvaluationResults,
          evalMissingFields: res.missingContextFields,
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
          {} as Record<keyof TypedFeatures, Feature>,
        );

      this._shared.logger?.debug("evaluated features", evaluatedFeatures);
    } else {
      this._shared.logger?.warn(
        "failed to use feature definitions, there are none cached yet. Using fallback features.",
      );
    }

    return maskedProxy(evaluatedFeatures, (features, key) => {
      void this.sendFeatureEvent({
        action: "check",
        key: key,
        targetingVersion: features[key].targetingVersion,
        evalResult: features[key].isEnabled,
      });

      return features[key].isEnabled;
    });
  }
}
