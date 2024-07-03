import { evaluateFlag } from "@bucketco/flag-evaluation";

import cache from "./cache";
import {
  API_HOST,
  FLAG_EVENTS_PER_MIN,
  FLAGS_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "./config";
import fetchClient from "./fetch-http-client";
import {
  Cache,
  ClientOptions,
  Company,
  Event,
  FeatureFlagEvent,
  Flag,
  FlagDefinitions,
  Flags,
  HttpClient,
  Logger,
  User,
} from "./types";
import { isObject, mergeDeep, ok, rateLimited, readNotifyProxy } from "./utils";

/**
 * The SDK client.
 *
 * @remarks
 * The client is used to interact with the Bucket API.
 * Use the client to track users, companies, events, and feature flag usage.
 **/
export class Client {
  private shared: {
    logger?: Logger;
    host: string;
    httpClient: HttpClient;
    refetchInterval: number;
    staleWarningInterval: number;
    headers: Record<string, string>;
    featureFlagDefinitionCache?: Cache<FlagDefinitions>;
  };

  private context: Record<string, any> | undefined;
  private company: Company | undefined;
  private user: User | undefined;
  private fallbackFlags: Flags | undefined;

  /**
   * Creates a new SDK client.
   *
   * @param options - The options for the client or an existing client to clone.
   **/
  constructor(options: ClientOptions | Client) {
    if (options instanceof Client) {
      this.shared = options.shared;
      this.context = options.context;
      this.company = options.company;
      this.user = options.user;
      this.fallbackFlags = options.fallbackFlags;

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
    this.shared = {
      logger: options.logger,
      host: options.host || API_HOST,
      headers: {
        "Content-Type": "application/json",
        [SDK_VERSION_HEADER_NAME]: SDK_VERSION,

        ["Authorization"]: `Bearer ${options.secretKey}`,
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
      const response = await this.shared.httpClient.post<
        TBody,
        { success: boolean }
      >(`${this.shared.host}/${path}`, this.shared.headers, body);

      this.shared.logger?.debug(`post request to "${path}"`, response.success);
      return response.success;
    } catch (error) {
      this.shared.logger?.error(
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
      const response = await this.shared.httpClient.get<
        TResponse & { success: boolean }
      >(`${this.shared.host}/${path}`, this.shared.headers);

      this.shared.logger?.debug(`get request to "${path}"`, response.success);

      if (!isObject(response) || response.success !== true) {
        return undefined;
      }

      const { success: _, ...result } = response;
      return result as TResponse;
    } catch (error) {
      this.shared.logger?.error(
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
    if (!this.shared.featureFlagDefinitionCache) {
      this.shared.featureFlagDefinitionCache = cache<FlagDefinitions>(
        this.shared.refetchInterval,
        this.shared.staleWarningInterval,
        this.shared.logger,
        async () => {
          const res = await this.get<FlagDefinitions>("flags");

          if (!isObject(res) || !Array.isArray(res?.flags)) {
            return undefined;
          }

          return res;
        },
      );

      void this.shared.featureFlagDefinitionCache.refresh();
    }

    return this.shared.featureFlagDefinitionCache;
  }

  /**
   * Sets the user for the client.
   *
   * @param user - The user to set.
   * @returns A new client with the user set.
   **/
  public withUser(user: User): Client {
    ok(isObject(user), "user must be an object");
    ok(
      typeof user.userId === "string" && user.userId.length > 0,
      "user must have a userId",
    );
    ok(
      user.attributes === undefined || isObject(user.attributes),
      "user attributes must be an object",
    );
    ok(
      user.context === undefined || isObject(user.context),
      "user context must be an object",
    );

    const client = new Client(this);
    client.user = user;

    return client;
  }

  /**
   * Sets the company for the client.
   *
   * @param company - The company to set.
   * @returns A new client with the company set.
   **/
  public withCompany(company: Company): Client {
    ok(isObject(company), "company must be an object");
    ok(
      typeof company.companyId === "string" && company.companyId.length > 0,
      "company must have a companyId",
    );
    ok(
      company.attributes === undefined || isObject(company.attributes),
      "company attributes must be an object",
    );
    ok(
      company.context === undefined || isObject(company.context),
      "company context must be an object",
    );

    const client = new Client(this);
    client.company = company;

    return client;
  }

  /**
   * Sets the custom context for the client.
   *
   * @param context - The context to set.
   * @returns A new client with the context set.
   **/
  public withCustomContext(context: Record<string, any>): Client {
    ok(isObject(context), "context must be an object");

    const client = new Client(this);
    client.context = context;

    return client;
  }

  /**
   * Updates the user in Bucket.
   *
   * @returns A boolean indicating if the request was successful.
   * @remarks
   * The user must be set before calling this method.
   **/
  public async updateUser() {
    ok(this.user !== undefined, "user is not defined");
    return await this.post("user", this.user);
  }

  /**
   * Updates the company in Bucket.
   *
   * @returns A boolean indicating if the request was successful.
   * @remarks
   * The company must be set before calling this method.
   **/
  public async updateCompany() {
    ok(this.company !== undefined, "company is not defined");

    const company = this.user
      ? { ...this.company, userId: this.user.userId }
      : this.company;

    return await this.post("company", company);
  }

  /**
   * Tracks an event in Bucket.
   *
   * @param event - The event to track.
   * @returns A boolean indicating if the request was successful.
   **/
  public async trackFeatureUsage(event: Event) {
    ok(isObject(event), "event must be an object");
    ok(
      typeof event.event === "string" && event.event.length > 0,
      "event must have a name",
    );
    ok(
      event.attributes === undefined || isObject(event.attributes),
      "event attributes must be an object",
    );
    ok(
      event.context === undefined || isObject(event.context),
      "event context must be an object",
    );

    return await this.post("event", event);
  }

  /**
   * Initializes the client. this call is optional, but it will fetch the feature flag definitions and warm up the cache.
   *
   * @returns void
   **/
  public async initialize(fallbackFlags?: Flags) {
    ok(
      fallbackFlags === undefined || typeof fallbackFlags === "object",
      "fallbackFlags must be an object",
    );

    this.fallbackFlags = fallbackFlags;
    await this.getFeatureFlagDefinitionCache().refresh();
  }

  /**
   * Gets the evaluated feature flags for the current context which includes the user, company, and custom context.
   *
   * @returns The evaluated feature flags.
   **/
  public getFlags() {
    const baseContext = {
      user: this.user && {
        id: this.user.userId,
        ...this.user.attributes,
      },
      company: this.company && {
        id: this.company.companyId,
        ...this.company.attributes,
      },
    };

    const mergedContext = mergeDeep(baseContext, this.context || {});
    const flagDefinitions = this.getFeatureFlagDefinitionCache().get();
    let evaluatedFlags: Flags | undefined = this.fallbackFlags || {};

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
        .reduce((acc, res) => {
          acc[res.flag.key] = {
            key: res.flag.key,
            value: res.value,
            version: keyToVersionMap.get(res.flag.key),
          };
          return acc;
        }, {} as Flags);

      this.shared.logger?.debug("evaluated flags", evaluatedFlags);
    } else {
      this.shared.logger?.warn(
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
