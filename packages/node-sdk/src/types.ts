import { FeatureData } from "@bucketco/flag-evaluation";

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
 * Describes the attributes of an user, company or event.
 **/
export type Attributes = Record<string, any>;

/**
 * Describes a feature event. Can be "check" or "evaluate".
 **/
export type FeatureEvent = {
  /**
   * The action that was performed.
   **/
  action: "evaluate" | "check";

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
  evalResult: boolean;

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
 * Describes a feature
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
}

/**
 * Describes a feature
 */
export interface Feature {
  /**
   * The key of the feature.
   */
  key: string;

  /**
   * If the feature is enabled.
   */
  isEnabled: boolean;

  /**
   * Track feature usage in Bucket.
   */
  track(): Promise<void>;
}

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
  : Record<keyof Features, Feature>;

/**
 * Describes the feature overrides.
 */
export type FeatureOverrides = Partial<Record<keyof TypedFeatures, boolean>>;
export type FeatureOverridesFn = (context: Context) => FeatureOverrides;

/**
 * Describes the response of the features endpoint
 */
export type FeaturesAPIResponse = {
  /** The feature definitions */
  features: (FeatureData & { targeting: { version: number } })[];
};

/**
 * Describes the response of a HTTP client.
 * @typeParam TResponse - The type of the response body.
 *
 */
export type HttpClientResponse<TResponse> = {
  /**
   * The status code of the response.
   **/
  status: number;

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
   **/
  maxSize?: number;

  /**
   * The interval in milliseconds at which the buffer is flushed.
   **/
  intervalMs?: number;
};

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
   * The host to send requests to (optional).
   **/
  host?: string;

  /**
   * The logger to use for logging (optional). Default is info level logging to console.
   **/
  logger?: Logger;

  /**
   * The features to "enable" as fallbacks when the API is unavailable (optional).
   **/
  fallbackFeatures?: (keyof TypedFeatures)[];

  /**
   * The HTTP client to use for sending requests (optional). Default is the built-in fetch client.
   **/
  httpClient?: HttpClient;

  /**
   * The options for the batch buffer (optional).
   * If not provided, the default options are used.
   **/
  batchOptions?: Omit<BatchBufferOptions<any>, "flushHandler" | "logger">;

  /**
   * If a filename is specified, feature targeting results be overridden with
   * the values from this file. The file should be a JSON object with feature
   * keys as keys and boolean values as values.
   *
   * If a function is specified, the function will be called with the context
   * and should return a record of feature keys and boolean values.
   *
   * Defaults to "bucketFeatures.json".
   **/
  featureOverrides?:
    | string
    | ((context: Context) => Partial<Record<keyof TypedFeatures, boolean>>);

  /**
   * In offline mode, no data is sent or fethed from the the Bucket API.
   * This is useful for testing or development.
   */
  offline?: boolean;

  /**
   * The path to the config file. If supplied, the config file will be loaded.
   * Defaults to `bucket.json` when NODE_ENV is not production. Can also be
   * set through the environment variable BUCKET_CONFIG_FILE.
   */
  configFile?: string;
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
   * The user context. If the user is set, the user ID is required.
   */
  user?: { id: string; [k: string]: any };
  /**
   * The company context. If the company is set, the company ID is required.
   */
  company?: { id: string; [k: string]: any };
  /**
   * The other context. This is used for any additional context that is not related to user or company.
   */
  other?: Record<string, any>;
};
