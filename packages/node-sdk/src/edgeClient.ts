import { BucketClient } from "./client";
import { ClientOptions } from "./types";

export type EdgeClientOptions = Omit<
  ClientOptions,
  "cacheStrategy" | "flushIntervalMs" | "batchOptions"
>;

/**
 * The EdgeClient is BucketClient pre-configured to be used in edge runtimes, like
 * Cloudflare Workers.
 *
 * @example
 * ```ts
 * // set the BUCKET_SECRET_KEY environment variable or pass the secret key in the constructor
 * const client = new EdgeClient();
 *
 * // evaluate a feature flag
 * const context = {
 *   user: { id: "user-id" },
 *   company: { id: "company-id" },
 * }
 * const { isEnabled } = client.getFeature(context, "feature-flag-key");
 *
 * ```
 */
export class EdgeClient extends BucketClient {
  constructor(options: EdgeClientOptions = {}) {
    const opts = {
      ...options,
      cacheStrategy: "in-request" as const,
      batchOptions: {
        intervalMs: 0,
      },
    };
    super(opts);
  }
}
