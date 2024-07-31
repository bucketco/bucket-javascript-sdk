import { FlagData } from "@bucketco/flag-evaluation";

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
 * Describes a feature flag evaluation event.
 **/
export type FeatureFlagEvent = {
  /**
   * The action that was performed.
   **/
  action: "evaluate" | "check";

  /**
   * The flag key.
   **/
  flagKey: string;

  /**
   * The flag version (optional).
   **/
  flagVersion: number | undefined;

  /**
   * The result of flag evaluation.
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
 * Describes an evaluated feature flag.
 */
export interface Flag {
  /**
   * The value of the flag.
   */
  value: boolean;

  /**
   * The key of the flag.
   */
  key: string;

  /**
   * The version of the flag (optional).
   */
  version?: number;
}

/**
 * Describes a collection of evaluated feature flags.
 *
 * @remarks
 * Extends the Flags interface to define the available flags.
 */
export interface Flags {}

/**
 * Describes a collection of (strong-typed) evaluated feature flags.
 *
 * @typeParam Flags - The type of the flags that is declared by the developer.
 */
export type TypedFlags = keyof Flags extends never
  ? Record<string, boolean>
  : Record<keyof Flags, boolean>;

/**
 * Describes the response of the feature flags endpoint
 */
export type FlagDefinitions = {
  /** The flag definitions */
  flags: (FlagData & { version: number })[];
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
 * Defines the options for the SDK client.
 *
 **/
export type ClientOptions = {
  /**
   * The secret key used to authenticate with the Bucket API.
   **/
  secretKey: string;

  /**
   * The host to send requests to (optional).
   **/
  host?: string;

  /**
   * The logger to use for logging (optional). Default is no logging.
   **/
  logger?: Logger;

  /**
   * The flags to use as fallbacks when the API is unavailable (optional).
   **/
  fallbackFlags?: TypedFlags;

  /**
   * The HTTP client to use for sending requests (optional). Default is the built-in fetch client.
   **/
  httpClient?: HttpClient;
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
 * The base, unbound Bucket client.
 */
export interface BucketClient
  extends BucketClientBase,
    BucketClientWithUserMethod<
      BucketClientUserMethods &
        BucketClientWithCompanyMethod<
          BucketClientCompanyMethods & BucketClientUserMethods
        >
    >,
    BucketClientWithCompanyMethod<
      BucketClientCompanyMethods &
        BucketClientWithUserMethod<
          BucketClientUserMethods & BucketClientCompanyMethods
        >
    > {}

/**
 * Useful interface to use as a type for the fully initialized Bucket client.
 **/
export interface BoundBucketClient
  extends BucketClientBase,
    BucketClientUserMethods,
    BucketClientCompanyMethods {}

/**
 * The base interface used for composition
 *
 * @remarks
 * Internal interface for composition.
 */
interface BucketClientBase {
  /**
   * Sets the extra, custom context for the client.
   *
   * @param context - The "extra" context to set.
   *
   * @returns A new client with the context set.
   * @throws An error if the context is not an object or the options are invalid.
   **/
  withOtherContext(context: Record<string, any>): this;

  /**
   * Gets the extra, custom context associated with the client.
   *
   * @returns The extra, custom context or `undefined` if it is not set.
   **/
  get otherContext(): Record<string, any> | undefined;

  /**
   * Initializes the client by caching the feature flag definitions.
   *
   * @returns void
   *
   * @remarks
   * Call this method before calling `getFlags` to ensure the feature flag definitions are cached.
   **/
  initialize(): Promise<void>;

  /**
   * Gets the evaluated feature flags for the current context which includes the user, company, and custom context.
   *
   * @typeparam TFlagKey - The type of the feature flag keys, `string` by default.
   *
   * @returns The evaluated feature flags.
   * @remarks
   * Call `initialize` before calling this method to ensure the feature flag definitions are cached, empty flags will be returned otherwise.
   **/
  getFlags(): Readonly<TypedFlags>;
}

/**
 * Contains the `withUser` method.
 *
 * @remarks
 * Internal interface for composition.
 */
interface BucketClientWithUserMethod<TReturn> {
  /**
   * Sets the user that is used for feature flag evaluation.
   *
   * @param userId - The user ID to set.
   * @param attributes - The attributes of the user (optional).
   *
   * @returns A new client with the user set.
   * @throws An error if the user ID is not a string or the options are invalid.
   * @remarks
   * If the user ID is the same as the current company, the attributes will be merged, and
   * the new attributes will take precedence.
   **/
  withUser(userId: string, attributes?: Attributes): BucketClientBase & TReturn;
}

/**
 * Contains the `withCompany` method.
 *
 * @remarks
 * Internal interface for composition.
 */
interface BucketClientWithCompanyMethod<TReturn> {
  /**
   * Sets the company that is used for feature flag evaluation.
   *
   * @param companyId - The company ID to set.
   * @param attributes - The attributes of the user (optional).
   *
   * @returns A new client with the company set.
   * @throws An error if the company ID is not a string or the options are invalid.
   * @remarks
   * If the company ID is the same as the current company, the attributes will be merged, and
   * the new attributes will take precedence.
   **/
  withCompany(
    companyId: string,
    ttributes?: Attributes,
  ): BucketClientBase & TReturn;
}

/**
 * Contains all user related methods.
 *
 * @remarks
 * Internal interface for composition.
 */
interface BucketClientUserMethods {
  /**
   * Gets the user associated with the client.
   *
   * @returns The user associated with the client.
   **/
  get user(): { userId: string; attrs?: Attributes };

  /**
   * Updates a user in Bucket.
   *
   * @param opts.attributes - The additional attributes of the user (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the options are invalid.
   **/
  updateUser(opts?: TrackOptions): Promise<boolean>;

  /**
   * Tracks an event in Bucket.
   *
   * @param event - The event to track.
   * @param opts.attributes - The attributes of the event (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the event is invalid or the options are invalid.
   * @remarks
   * If the company is set, the event will be associated with the company.
   **/
  trackFeatureUsage(event: string, opts?: TrackOptions): Promise<boolean>;
}

/**
 * Contains all company related methods.
 *
 * @remarks
 * Internal interface for composition.
 */
interface BucketClientCompanyMethods {
  /**
   * Gets the company associated with the client.
   *
   * @returns The company associated with the client.
   **/
  get company(): { companyId: string; attrs?: Attributes };

  /**
   * Updates the associated company in Bucket.
   *
   * @param opts.attributes - The additional attributes of the company (optional).
   * @param opts.meta - The meta context associated with tracking (optional).
   *
   * @returns A boolean indicating if the request was successful.
   * @throws An error if the company is not set or the options are invalid.
   * @remarks
   * If the user is set, the company will be associated with the user.
   **/
  updateCompany(opts?: TrackOptions): Promise<boolean>;
}
