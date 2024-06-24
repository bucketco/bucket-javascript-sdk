/**
 * Describes a feature flag
 */
export interface Flag {
  /**
   * The value of the flag
   */
  value: boolean;
  /**
   * The key of the flag
   */
  key: string;

  /**
   * The version of the flag
   */
  version: number;
}

/**
 * Describes the response of the feature flags endpoint
 */
export type Flags = Record<string, Flag>;

/**
 * Describes the request options for the feature flags
 */
export type FeatureFlagsOptions = {
  /**
   * The context to be used when evaluating the flags
   */
  context: Record<string, any>;
  /**
   * The fallback flags to be used when the flags are not available
   */
  fallbackFlags?: Flag[];
  /**
   * The timeout in milliseconds for the request
   */
  timeoutMs?: number;
  /**
   * Whether to use the stale flags while revalidating the flags
   */
  staleWhileRevalidate?: boolean;
};
