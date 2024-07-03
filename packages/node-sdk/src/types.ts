import { FlagData } from "@bucketco/flag-evaluation";

/**
 * Describes the context of an user or company.
 **/
type Context = {
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
 * Describes the payload of an user, company or event.
 **/
interface Payload {
  /**
   * The attributes of the user, company or event (optional).
   **/
  attributes?: Attributes;

  /**
   * The context of the user or company (optional).
   **/
  context?: Context;
}

/**
 * Describes an user.
 **/
export type User = Payload & {
  /**
   * The user ID.
   **/
  userId: string;
};

/**
 * Describes a company.
 **/
export type Company = Payload & {
  /**
   * The company ID.
   **/
  companyId: string;
};

/**
 * Describes an event.
 **/
export type Event = Payload & {
  /**
   * The event name.
   **/
  event: string;
};

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
 */
export type Flags = Record<string, Flag>;

/**
 * Describes the response of the feature flags endpoint
 */
export type FlagDefinitions = {
  /** The flag definitions */
  flags: (FlagData & { version: number })[];
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
  ): Promise<TResponse>;

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
  ): Promise<TResponse>;
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
   * The interval to re-fetch feature flag definitions (optional). Default is 60 seconds.
   **/
  refetchInterval?: number;

  /**
   * The interval to re-fetch feature flags (optional). Default is 5 times the refetch interval.
   **/
  staleWarningInterval?: number;

  /**
   * The logger to use for logging (optional). Default is no logging.
   **/
  logger?: Logger;

  /**
   * The HTTP client to use for sending requests (optional). Default is the built-in fetch client.
   **/
  httpClient?: HttpClient;
};
