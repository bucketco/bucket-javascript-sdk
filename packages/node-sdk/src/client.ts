import { evaluateFlag } from "@bucketco/flag-evaluation";

import cache from "./cache";
import {
  API_HOST,
  BUCKET_LOG_PREFIX,
  FLAG_EVENTS_PER_MIN,
  FLAGS_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "./config";
import fetchClient from "./fetch-http-client";
import {
  Attributes,
  Cache,
  ClientOptions,
  FeatureFlagEvent,
  Flag,
  FlagDefinitions,
  Flags,
  HttpClient,
  Logger,
  TrackingMeta,
} from "./types";
import {
  decorateLogger,
  isObject,
  ok,
  rateLimited,
  readNotifyProxy,
} from "./utils";

/**
 * The SDK client.
 *
 * @remarks
 * The client is used to interact with the Bucket API.
 * Use the client to track users, companies, events, and feature flag usage.
 **/
export class BucketClient {
  private _shared: {
    logger?: Logger;
    host: string;
    secretKey: string;
    httpClient: HttpClient;
    refetchInterval: number;
    staleWarningInterval: number;
    headers: Record<string, string>;
    featureFlagDefinitionCache?: Cache<FlagDefinitions>;
  };

  private _customContext: Record<string, any> | undefined;
  private _company: { companyId: string; attrs?: Attributes } | undefined;
  private _user: { userId: string; attrs?: Attributes } | undefined;
  private _fallbackFlags: Record<string, Flag> | undefined;

  /**
   * Creates a new SDK client.
   *
   * @param options - The options for the client or an existing client to clone.
   **/
  constructor(options: ClientOptions | BucketClient) {
    if (options instanceof BucketClient) {
      this._shared = options._shared;
      this._customContext = options._customContext;
      this._company = options._company;
      this._user = options._user;
      this._fallbackFlags = options._fallbackFlags;

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
      options.refetchInterval === undefined ||
        typeof options.refetchInterval === "number",
      "refetchInterval must be a number",
    );
    ok(
      options.staleWarningInterval === undefined ||
        typeof options.staleWarningInterval === "number",
      "staleWarningInterval must be a number",
    );

    const refetchInterval = options.refetchInterval || FLAGS_REFETCH_MS;
    this._shared = {
      logger:
        options.logger && decorateLogger(BUCKET_LOG_PREFIX, options.logger),
      host: options.host || API_HOST,
      secretKey: options.secretKey,
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
      },
      httpClient: options.httpClient || fetchClient,
      refetchInterval,
      staleWarningInterval: options.staleWarningInterval || refetchInterval * 5,
    };
  }

  /**
   * Sends a POST request to the specified path.
   *
   * @param path - The path to send the request to.
   * @param body - The body of the request.
   * @returns A boolean indicating if the request was successful.
   **/
  private async post<TBody>(path: string, body: TBody) {
    ok(typeof path === "string" && path.length > 0, "path must be a string");
    ok(typeof body === "object", "body must be an object");

    try {
      const response = await this._shared.httpClient.post<
        TBody,
        { success: boolean }
      >(
        `${this._shared.host}/${path}`,
        {
          ...this._shared.headers,
          ["Authorization"]: `Bearer ${this._shared.secretKey}`,
        },
        body,
      );

      this._shared.logger?.debug(`post request to "${path}"`, response.success);
      return response.success;
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
   **/
  private async get<TResponse>(path: string) {
    ok(typeof path === "string" && path.length > 0, "path must be a string");

    try {
      const response = await this._shared.httpClient.get<
        TResponse & { success: boolean }
      >(
        `${this._shared.host}/${path}&key=${this._shared.secretKey}`,
        this._shared.headers,
      );

      this._shared.logger?.debug(`get request to "${path}"`, response.success);

      if (!isObject(response) || response.success !== true) {
        return undefined;
      }

      const { success: _, ...result } = response;
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
   * Sends a feature flag event to the Bucket API.
   *
   * @param event - The event to send.
   * @returns A boolean indicating if the request was successful.
   **/
  private async sendFeatureFlagEvent(event: FeatureFlagEvent) {
    ok(typeof event === "object", "event must be an object");
    ok(
      typeof event.action === "string" &&
        (event.action === "evaluate" || event.action === "check"),
      "event must have an action",
    );
    ok(
      typeof event.flagKey === "string" && event.flagKey.length > 0,
      "event must have a flag key",
    );
    ok(
      typeof event.flagVersion === "number" || event.flagVersion === undefined,
      "event must have a flag version",
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

    return await this.post("flags/events", {
      action: event.action,
      flagKey: event.flagKey,
      flagVersion: event.flagVersion,
      evalContext: event.evalContext,
      evalResult: event.evalResult,
      evalRuleResults: event.evalRuleResults,
      evalMissingFields: event.evalMissingFields,
    });
  }

  private getFeatureFlagDefinitionCache() {
    if (!this._shared.featureFlagDefinitionCache) {
      this._shared.featureFlagDefinitionCache = cache<FlagDefinitions>(
        this._shared.refetchInterval,
        this._shared.staleWarningInterval,
        this._shared.logger,
        async () => {
          const res = await this.get<FlagDefinitions>("flags");

          if (!isObject(res) || !Array.isArray(res?.flags)) {
            return undefined;
          }

          return res;
        },
      );
    }

    return this._shared.featureFlagDefinitionCache;
  }

  /**
   * Sets the user that is used for feature flag evaluation.
   *
   * @param userId - The user ID to set.
   * @param opts.attrs - The attributes of the user (optional).
   *
   * @returns A new client with the user set.
   *
   * @remarks
   * If the user ID is the same as the current company, the attributes will be merged, and
   * the new attributes will take precedence.
   **/
  public withUser(
    userId: string,
    opts?: { attributes?: Attributes },
  ): BucketClient {
    ok(
      typeof userId === "string" && userId.length > 0,
      "userId must be a string",
    );
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );

    const client = new BucketClient(this);
    if (userId !== this._user?.userId) {
      client._user = { userId, attrs: opts?.attributes };
    } else {
      client._user = {
        userId: this._user.userId,
        attrs: { ...this._user.attrs, ...opts?.attributes },
      };
    }

    return client;
  }

  /**
   * Sets the company that is used for feature flag evaluation.
   *
   * @param companyId - The company ID to set.
   * @param opts.attrs - The attributes of the user (optional).
   *
   * @returns A new client with the company set.
   *
   * @remarks
   * If the company ID is the same as the current company, the attributes will be merged, and
   * the new attributes will take precedence.
   **/
  public withCompany(
    companyId: string,
    opts?: { attributes?: Attributes },
  ): BucketClient {
    ok(
      typeof companyId === "string" && companyId.length > 0,
      "companyId must be a string",
    );
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.attributes === undefined || isObject(opts.attributes),
      "attributes must be an object",
    );

    const client = new BucketClient(this);
    if (companyId !== this._company?.companyId) {
      client._company = { companyId, attrs: opts?.attributes };
    } else {
      client._company = {
        companyId: this._company.companyId,
        attrs: { ...this._company.attrs, ...opts?.attributes },
      };
    }

    return client;
  }

  /**
   * Sets the custom context for the client.
   *
   * @param context - The context to set.
   * @param opts.replace - A boolean indicating if the context should replace the current context or be merged (optional).
   *
   * @returns A new client with the context set.
   *
   * @remarks
   * If replace is true, the context will replace the current context, otherwise it will be merged.
   * The new context will take precedence over the old context.
   **/
  public withCustomContext(
    context: Record<string, any>,
    opts?: { replace?: boolean },
  ): BucketClient {
    ok(isObject(context), "context must be an object");

    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.replace === undefined || typeof opts.replace === "boolean",
      "replace must be a boolean",
    );

    const client = new BucketClient(this);

    if (!opts?.replace) {
      client._customContext = { ...this._customContext, ...context };
    } else {
      client._customContext = context;
    }

    return client;
  }

  /**
   * Gets the custom context associated with the client.
   *
   * @returns The custom context or `undefined` if it is not set.
   **/
  public get customContext() {
    return this._customContext;
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
   * Tracks a user in Bucket.
   *
   * @param userId - The user ID to track.
   * @param opts.attrs - The attributes of the user (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   **/
  public async trackUser(
    userId: string,
    opts?: {
      attributes?: Attributes;
      meta?: TrackingMeta;
    },
  ) {
    ok(
      typeof userId === "string" && userId.length > 0,
      "userId must be a string",
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
   * Tracks a company in Bucket.
   *
   * @param companyId - The company ID to track.
   * @param opts.userId - The user ID associated with the company (optional).
   * @param opts.attrs - The attributes of the company (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   **/
  public async trackCompany(
    companyId: string,
    opts?: {
      userId?: string;
      attributes?: Attributes;
      meta?: TrackingMeta;
    },
  ) {
    ok(
      typeof companyId === "string" && companyId.length > 0,
      "companyId must be a string",
    );
    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.userId === undefined ||
        (typeof opts.userId === "string" && opts.userId.length > 0),
      "userId must be a string",
    );
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
   *
   * @param event - The event to track.
   * @param opts.companyId - The company ID associated with the event (optional).
   * @param opts.userId - The user ID associated with the event (optional).
   * @param opts.attrs - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   **/
  public async trackFeatureUsage(
    event: string,
    opts?: {
      companyId?: string;
      userId?: string;
      attributes?: Attributes;
      meta?: TrackingMeta;
    },
  ) {
    ok(typeof event === "string" && event.length > 0, "event must be a string");

    ok(opts === undefined || isObject(opts), "opts must be an object");
    ok(
      opts?.userId === undefined ||
        (typeof opts.userId === "string" && opts.userId.length > 0),
      "userId must be a string",
    );
    ok(
      opts?.companyId === undefined ||
        (typeof opts.companyId === "string" && opts.companyId.length > 0),
      "companyId must be a string",
    );
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
      companyId: opts?.companyId,
      userId: opts?.userId,
      attributes: opts?.attributes,
      context: opts?.meta,
    });
  }

  /**
   * Initializes the client by caching the feature flag definitions.
   *
   * @typeparam TFlagKey - The type of the feature flag keys, `string` by default.
   *
   * @param fallbackFlags - The fallback flags to use if the feature flag definitions are not available.
   * @returns void
   *
   * @remarks
   * Call this method before calling `getFlags` to ensure the feature flag definitions are cached or at least the fallback flags are set.
   **/
  public async initialize<TFlagKey extends string = string>(
    fallbackFlags?: Record<TFlagKey, Omit<Flag, "key" | "version">>,
  ) {
    ok(
      fallbackFlags === undefined || typeof fallbackFlags === "object",
      "fallbackFlags must be an object",
    );

    this._fallbackFlags =
      fallbackFlags &&
      Object.entries(fallbackFlags).reduce(
        (acc, [key, value]) => {
          acc[key as TFlagKey] = {
            key,
            ...(value as Omit<Flag, "key" | "version">),
          };
          return acc;
        },
        {} as Record<TFlagKey, Flag>,
      );

    await this.getFeatureFlagDefinitionCache().refresh();
  }

  /**
   * Gets the evaluated feature flags for the current context which includes the user, company, and custom context.
   *
   * @typeparam TFlagKey - The type of the feature flag keys, `string` by default.
   *
   * @returns The evaluated feature flags.
   *
   * @remarks
   * Call `initialize` before calling this method to ensure the feature flag definitions are cached, empty flags will be returned otherwise.
   **/
  public getFlags<TFlagKey extends string = string>() {
    const mergedContext = {
      user: this._user && {
        id: this._user.userId,
        ...this._user.attrs,
      },
      company: this._company && {
        id: this._company.companyId,
        ...this._company.attrs,
      },
      ...this._customContext,
    };

    const flagDefinitions = this.getFeatureFlagDefinitionCache().get();
    let evaluatedFlags: Flags<TFlagKey> =
      (this._fallbackFlags as Flags<TFlagKey>) || {};

    if (flagDefinitions) {
      const keyToVersionMap = new Map<string, number>(
        flagDefinitions.flags.map((f) => [f.key, f.version]),
      );

      const evaluated = flagDefinitions.flags.map((flag) =>
        evaluateFlag({ context: mergedContext, flag }),
      );

      evaluated.forEach(async (res) => {
        await this.sendFeatureFlagEvent({
          action: "evaluate",
          flagKey: res.flag.key,
          flagVersion: keyToVersionMap.get(res.flag.key),
          evalResult: res.value,
          evalContext: res.context,
          evalRuleResults: res.ruleEvaluationResults,
          evalMissingFields: res.missingContextFields,
        });
      });

      evaluatedFlags = evaluated
        .filter((e) => e.value)
        .reduce(
          (acc, res) => {
            acc[res.flag.key as TFlagKey] = {
              key: res.flag.key,
              value: res.value,
              version: keyToVersionMap.get(res.flag.key),
            };
            return acc;
          },
          {} as Record<TFlagKey, Flag>,
        );

      this._shared.logger?.debug("evaluated flags", evaluatedFlags);
    } else {
      this._shared.logger?.warn(
        "failed to use feature flag definitions, there are none cached yet. using fallback flags.",
      );
    }

    return readNotifyProxy(
      evaluatedFlags,
      rateLimited(FLAG_EVENTS_PER_MIN, async (_: string, res: Flag) => {
        await this.sendFeatureFlagEvent({
          action: "check",
          flagKey: res.key,
          flagVersion: res.version,
          evalResult: res.value,
        });
      }),
    );
  }
}
