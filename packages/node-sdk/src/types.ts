/* eslint-disable @typescript-eslint/no-empty-object-type */

import { newEvaluator, RuleFilter } from "@bucketco/flag-evaluation";

/**
 * Describes the meta context associated with tracking.
 **/
export type TrackingMeta = {
  /**
   * Whether the user or company is active.
   **/
  active?: boolean;
};

/**
 * Describes the attributes of a user, company or event.
 **/
export type Attributes = Record<string, any>;

/**
 * Describes a feature event. Can be "check" or "evaluate".
 **/
export type FeatureEvent = {
  /**
   * The action that was performed.
   **/
  action: "evaluate" | "evaluate-config" | "check" | "check-config";

  /**
   * The feature key.
   **/
  key: string;

  /**
   * The feature targeting version (optional).
   **/
  targetingVersion: number | undefined;

  /**
   * The result of targeting evaluation.
   **/
  evalResult:
    | boolean
    | { key: string; payload: any }
    | { key: undefined; payload: undefined };

  /**
   * The context that was used for evaluation.
   **/
  evalContext?: Record<string, any>;

  /**
   * The result of evaluation of each rule (optional).
   **/
  evalRuleResults?: boolean[];

  /**
   * The missing fields in the evaluation context (optional).
   **/
  evalMissingFields?: string[];
};

/**
 * A remotely managed configuration value for a feature.
 */
export type RawFeatureRemoteConfig = {
  /**
   * The key of the matched configuration value.
   */
  key: string;

  /**
   * The version of the targeting rules used to select the config value.
   */
  targetingVersion?: number;

  /**
   * The optional user-supplied payload data.
   */
  payload: any;

  /**
   * The rule results of the evaluation (optional).
   */
  ruleEvaluationResults?: boolean[];

  /**
   * The missing fields in the evaluation context (optional).
   */
  missingContextFields?: string[];
};

/**
 * Describes a feature.
 */
export interface RawFeature {
  /**
   * The key of the feature.
   */
  key: string;

  /**
   * If the feature is enabled.
   */
  isEnabled: boolean;

  /**
   * The version of the targeting used to evaluate if the feature is enabled (optional).
   */
  targetingVersion?: number;

  /**
   * The remote configuration value for the feature.
   */
  config?: RawFeatureRemoteConfig;

  /**
   * The rule results of the evaluation (optional).
   */
  ruleEvaluationResults?: boolean[];

  /**
   * The missing fields in the evaluation context (optional).
   */
  missingContextFields?: string[];
}

export type EmptyFeatureRemoteConfig = { key: undefined; payload: undefined };

/**
 * A remotely managed configuration value for a feature.
 */
export type FeatureRemoteConfig =
  | {
      /**
       * The key of the matched configuration value.
       */
      key: string;

      /**
       * The optional user-supplied payload data.
       */
      payload: any;
    }
  | EmptyFeatureRemoteConfig;

/**
 * Describes a feature
 */
export interface Feature<
  TConfig extends FeatureType["config"] = EmptyFeatureRemoteConfig,
> {
  /**
   * The key of the feature.
   */
  key: string;

  /**
   * If the feature is enabled.
   */
  isEnabled: boolean;

  /*
   * Optional user-defined configuration.
   */
  config:
    | ({
        key: string;
      } & TConfig)
    | EmptyFeatureRemoteConfig;

  /**
   * Track feature usage in Bucket.
   */
  track(): Promise<void>;
}

export type FeatureType = {
  config?: {
    payload: any;
  };
};

export type FeatureOverride =
  | (FeatureType & {
      isEnabled: boolean;
      config?: {
        key: string;
      };
    })
  | boolean;

/**
 * Describes a feature definition.
 */
export type FeatureDefinition = {
  /**
   * The key of the feature.
   */
  key: string;

  /**
   * Description of the feature.
   */
  description: string | null;

  /**
   * The targeting rules for the feature.
   */
  flag: {
    /**
     * The version of the targeting rules.
     */
    version: number;

    /**
     * The targeting rules.
     */
    rules: {
      /**
       * The filter for the rule.
       */
      filter: RuleFilter;
    }[];
  };

  /**
   * The remote configuration for the feature.
   */
  config?: {
    /**
     * The version of the remote configuration.
     */
    version: number;

    /**
     * The variants of the remote configuration.
     */
    variants: FeatureConfigVariant[];
  };
};

/**
 * Describes a collection of evaluated features.
 *
 * @remarks
 * You should extend the Features interface to define the available features.
 */
export interface Features {}

/**
 * Describes a collection of evaluated feature.
 *
 * @remarks
 * This types falls back to a generic Record<string, Feature> if the Features interface
 * has not been extended.
 *
 */
export type TypedFeatures = keyof Features extends never
  ? Record<string, Feature>
  : {
      [FeatureKey in keyof Features]: Features[FeatureKey] extends FeatureType
        ? Feature<Features[FeatureKey]["config"]>
        : Feature;
    };

export type TypedFeatureKey = keyof TypedFeatures;

/**
 * Describes the feature overrides.
 */
export type FeatureOverrides = Partial<
  keyof Features extends never
    ? Record<string, FeatureOverride>
    : {
        [FeatureKey in keyof Features]: Features[FeatureKey] extends FeatureOverride
          ? Features[FeatureKey]
          : Exclude<FeatureOverride, "config">;
      }
>;

export type FeatureOverridesFn = (context: Context) => FeatureOverrides;

/**
 * Describes a remote feature config variant.
 */
export type FeatureConfigVariant = {
  /**
   * The filter for the variant.
   */
  filter: RuleFilter;

  /**
   * The optional user-supplied payload data.
   */
  payload: any;

  /**
   * The key of the variant.
   */
  key: string;
};

/**
 * (Internal) Describes a specific feature in the API response.
 *
 * @internal
 */
export type FeatureAPIResponse = {
  /**
   * The key of the feature.
   */
  key: string;

  /**
   * Description of the feature.
   */
  description: string | null;

  /**
   * The targeting rules for the feature.
   */
  targeting: {
    /**
     * The version of the targeting rules.
     */
    version: number;

    /**
     * The targeting rules.
     */
    rules: {
      /**
       * The filter for the rule.
       */
      filter: RuleFilter;
    }[];
  };

  /**
   * The remote configuration for the feature.
   */
  config?: {
    /**
     * The version of the remote configuration.
     */
    version: number;

    /**
     * The variants of the remote configuration.
     */
    variants: FeatureConfigVariant[];
  };
};

/**
 * (Internal) Describes the response of the features endpoint.
 *
 * @internal
 */
export type FeaturesAPIResponse = {
  /**
   * The feature definitions.
   */
  features: FeatureAPIResponse[];
};

/**
 * (Internal) Feature definitions with the addition of a pre-prepared
 * evaluators functions for the rules.
 *
 * @internal
 */
export type CachedFeatureDefinition = FeatureAPIResponse & {
  enabledEvaluator: ReturnType<typeof newEvaluator<boolean>>;
  configEvaluator: ReturnType<typeof newEvaluator<any>> | undefined;
};

/**
 * (Internal) Describes the response of the evaluated features endpoint.
 *
 * @internal
 */
export type EvaluatedFeaturesAPIResponse = {
  /**
   * True if request successful.
   */
  success: boolean;

  /**
   * True if additional context for user or company was found and used for evaluation on the remote server.
   */
  remoteContextUsed: boolean;

  /**
   * The feature definitions.
   */
  features: RawFeature[];
};

/**
 * Describes the response of a HTTP client.
 *
 * @typeParam TResponse - The type of the response body.
 */
export type HttpClientResponse<TResponse> = {
  /**
   * The status code of the response.
   **/
  status: number;

  /**
   * Indicates that the request succeeded.
   **/
  ok: boolean;

  /**
   * The body of the response if available.
   **/
  body: TResponse | undefined;
};

/**
 * Defines the interface for an HTTP client.
 *
 * @remarks
 * This interface is used to abstract the HTTP client implementation from the SDK.
 * Define your own implementation of this interface to use a different HTTP client.
 **/
export interface HttpClient {
  /**
   * Sends a POST request to the specified URL.
   *
   * @param url - The URL to send the request to.
   * @param headers - The headers to include in the request.
   * @param body - The body of the request.
   * @returns The response from the server.
   **/
  post<TBody, TResponse>(
    url: string,
    headers: Record<string, string>,
    body: TBody,
  ): Promise<HttpClientResponse<TResponse>>;

  /**
   * Sends a GET request to the specified URL.
   *
   * @param url - The URL to send the request to.
   * @param headers - The headers to include in the request.
   * @returns The response from the server.
   **/
  get<TResponse>(
    url: string,
    headers: Record<string, string>,
    timeoutMs: number,
  ): Promise<HttpClientResponse<TResponse>>;
}

/**
 * Logger interface for logging messages
 */
export interface Logger {
  /**
   * Log a debug messages
   *
   * @param message - The message to log
   * @param data - Optional data to log
   */
  debug: (message: string, data?: any) => void;

  /**
   * Log an info messages
   *
   * @param message - The message to log
   * @param data - Optional data to log
   */
  info: (message: string, data?: any) => void;

  /**
   * Log a warning messages
   *
   * @param message - The message to log
   * @param data - Optional data to log
   */
  warn: (message: string, data?: any) => void;

  /**
   * Log an error messages
   *
   * @param message - The message to log
   * @param data - Optional data to log
   */
  error: (message: string, data?: any) => void;
}

/**
 * A cache for storing values.
 *
 * @typeParam T - The type of the value.
 **/
export type Cache<T> = {
  /**
   * Get the value.
   * @returns The value or `undefined` if the value is not available.
   **/
  get: () => T | undefined;

  /**
   * Refresh the value immediately and return it, or `undefined` if the value is not available.
   *
   * @returns The value or `undefined` if the value is not available.
   **/
  refresh: () => Promise<T | undefined>;

  /**
   * If a refresh is in progress, wait for it to complete.
   *
   * @returns A promise that resolves when the refresh is complete.
   **/
  waitRefresh: () => Promise<void> | undefined;
};

/**
 * Options for configuring the BatchBuffer.
 *
 * @template T - The type of items in the buffer.
 */
export type BatchBufferOptions<T> = {
  /**
   * A function that handles flushing the items in the buffer.
   **/
  flushHandler: (items: T[]) => Promise<void>;

  /**
   * The logger to use for logging (optional).
   **/
  logger?: Logger;

  /**
   * The maximum size of the buffer before it is flushed.
   *
   * @defaultValue `100`
   **/
  maxSize?: number;

  /**
   * The interval in milliseconds at which the buffer is flushed.
   * @remarks
   * If `0`, the buffer is flushed only when `maxSize` is reached.
   * @defaultValue `1000`
   **/
  intervalMs?: number;

  /**
   * Whether to flush the buffer on exit.
   *
   * @defaultValue `true`
   */
  flushOnExit?: boolean;
};

export type CacheStrategy = "periodically-update" | "in-request";

/**
 * Defines the options for the SDK client.
 *
 **/
export type ClientOptions = {
  /**
   * The secret key used to authenticate with the Bucket API.
   **/
  secretKey?: string;

  /**
   * @deprecated
   * Use `apiBaseUrl` instead.
   **/
  host?: string;

  /**
   * The host to send requests to (optional).
   **/
  apiBaseUrl?: string;

  /**
   * The logger to use for logging (optional). Default is info level logging to console.
   **/
  logger?: Logger;

  /**
   * Use the console logger, but set a log level. Ineffective if a custom logger is provided.
   **/
  logLevel?: LogLevel;

  /**
   * The features to "enable" as fallbacks when the API is unavailable (optional).
   * Can be an array of feature keys, or a record of feature keys and boolean or object values.
   *
   * If a record is supplied instead of array, the values of each key are either the
   * configuration values or the boolean value `true`.
   **/
  fallbackFeatures?:
    | TypedFeatureKey[]
    | Record<TypedFeatureKey, Exclude<FeatureOverride, false>>;

  /**
   * The HTTP client to use for sending requests (optional). Default is the built-in fetch client.
   **/
  httpClient?: HttpClient;

  /**
   * The timeout in milliseconds for fetching feature targeting data (optional).
   * Default is 10000 ms.
   **/
  fetchTimeoutMs?: number;

  /**
   * Number of times to retry fetching feature definitions (optional).
   * Default is 3 times.
   **/
  featuresFetchRetries?: number;

  /**
   * The options for the batch buffer (optional).
   * If not provided, the default options are used.
   **/
  batchOptions?: Omit<BatchBufferOptions<any>, "flushHandler" | "logger">;

  /**
   * If a filename is specified, feature targeting results be overridden with
   * the values from this file. The file should be a JSON object with feature
   * keys as keys, and boolean or object as values.
   *
   * If a function is specified, the function will be called with the context
   * and should return a record of feature keys and boolean or object values.
   *
   * Defaults to "bucketFeatures.json".
   **/
  featureOverrides?: string | ((context: Context) => FeatureOverrides);

  /**
   * In offline mode, no data is sent or fetched from the the Bucket API.
   * This is useful for testing or development.
   */
  offline?: boolean;

  /**
   * The path to the config file. If supplied, the config file will be loaded.
   * Defaults to `bucket.json` when NODE_ENV is not production. Can also be
   * set through the environment variable BUCKET_CONFIG_FILE.
   */
  configFile?: string;

  /**
   * The cache strategy to use for the client (optional, defaults to "periodically-update").
   **/
  cacheStrategy?: CacheStrategy;
};

/**
 * Defines the options for tracking of entities.
 *
 **/
export type TrackOptions = {
  /**
   * The attributes associated with the event.
   **/
  attributes?: Attributes;

  /**
   * The meta context associated with the event.
   **/
  meta?: TrackingMeta;
};

/**
 * Describes the current user context, company context, and other context.
 * This is used to determine if feature targeting matches and to track events.
 **/
export type Context = {
  /**
   * The user context. If no `id` key is set, the whole object is ignored.
   */
  user?: {
    /**
     * The identifier of the user.
     */
    id: string | number | undefined;

    /**
     * The name of the user.
     */
    name?: string | undefined;

    /**
     * The email of the user.
     */
    email?: string | undefined;

    /**
     * The avatar URL of the user.
     */
    avatar?: string | undefined;

    /**
     * Custom attributes of the user.
     */
    [k: string]: any;
  };
  /**
   * The company context. If no `id` key is set, the whole object is ignored.
   */
  company?: {
    /**
     * The identifier of the company.
     */
    id: string | number | undefined;

    /**
     * The name of the company.
     */
    name?: string | undefined;

    /**
     * The avatar URL of the company.
     */
    avatar?: string | undefined;

    /**
     * Custom attributes of the company.
     */
    [k: string]: any;
  };

  /**
   * The other context. This is used for any additional context that is not related to user or company.
   */
  other?: Record<string, any>;
};

/**
 * A context with tracking option.
 **/
export interface ContextWithTracking extends Context {
  /**
   * Enable tracking for the context.
   * If set to `false`, tracking will be disabled for the context. Default is `true`.
   */
  enableTracking?: boolean;

  /**
   * The meta context used to update the user or company when syncing is required during
   * feature retrieval.
   */
  meta?: TrackingMeta;
}

export const LOG_LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export type IdType = string | number;
