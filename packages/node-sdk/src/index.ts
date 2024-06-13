import { evaluateFlag } from "@bucketco/flag-evaluation";
import { Flag, Flags } from "@bucketco/tracking-sdk";
import {
  Context,
  TrackedEvent,
  Feedback,
  FlagContext,
  FlagConfiguration,
} from "./types";

export type BucketOptions = {
  publishableKey: string;
  secretKey: string;
  apiHost?: string;
  pollInterval?: number;
  evaluator?: FlagEvaluator; // TODO: always make user construct this themselves?
};

const DEFAULT_OPTIONS: Required<
  Omit<BucketOptions, "publishableKey" | "secretKey" | "evaluator">
> = {
  apiHost: "https://ingest.bucket.co",
  pollInterval: 10 * 60 * 1000,
};

export interface FlagEvaluator {
  getFlags(context: Record<string, unknown>): Promise<Flags>;
  getFlag(key: string, context: Record<string, unknown>): Promise<Flag | null>;
}

export default class Bucket {
  private options: Required<Omit<BucketOptions, "evaluator">>; // TODO: clean up types
  private evaluator: FlagEvaluator;

  // TODO: should we use secret key only?
  constructor(options: BucketOptions) {
    this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    this.evaluator =
      options.evaluator ??
      new LocalFlagEvaluator({
        secretKey: this.options.secretKey,
        apiHost: this.options.apiHost,
        pollInterval: this.options.pollInterval,
      });
  }

  async track(
    eventName: string,
    options: {
      userId: string;
      companyId: string;
      attributes?: Record<string, any>;
      context?: Context;
    },
  ) {
    if (!eventName) {
      throw new Error("'eventName' must be provided");
    }

    if (!options.userId || !options.companyId) {
      throw new Error("'userId' and 'companyId' must be provided");
    }

    const payload: TrackedEvent = {
      event: eventName,
      ...options,
    };

    const url = new URL("/event", this.options.apiHost);
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.json(); // TODO: improve?
  }

  async feedback(feedback: Feedback) {
    if (!feedback.featureId || !feedback.userId || !feedback.companyId) {
      throw new Error("'featureId', 'userId' and 'companyId' must be provided");
    }

    if (!feedback.score && !feedback.comment) {
      throw new Error("Either 'score' or 'comment' must be provided");
    }

    const payload = { ...feedback, source: "sdk" }; // TODO: node-sdk?

    const url = new URL("/feedback", this.options.apiHost);
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.json(); // TODO: improve?
  }

  async getFeatureFlags(context: FlagContext) {
    return this.evaluator.getFlags(context);
  }

  async getFeatureFlag(key: string, context: FlagContext) {
    return this.evaluator.getFlag(key, context);
  }
}

export class LocalFlagEvaluator implements FlagEvaluator {
  private flagConfigurations: FlagConfiguration[] = [];
  private readyPromise: Promise<boolean>;

  constructor(
    private options: {
      secretKey: string;
      apiHost: string;
      pollInterval: number;
    },
  ) {
    this.readyPromise = new Promise(async (resolve) => {
      await this.loadFlagConfigurations();
      resolve(true);
    });
  }

  async getFlags(context: FlagContext) {
    await this.readyPromise;

    const results = await Promise.all(
      this.flagConfigurations.map(async (configuration) => {
        return await evaluateFlag({ context, flag: configuration.flag });
      }),
    );

    return results.reduce((acc, result) => {
      return { ...acc, [result.key]: result };
    }, {});
  }

  async getFlag(key: string, context: FlagContext) {
    await this.readyPromise;

    const configuration = this.flagConfigurations.find((c) => c.key === key);
    if (!configuration) {
      // TODO: what?
      console.error(`Flag '${key}' does not exist, returning null`);
      return null;
    }

    return await evaluateFlag({ context, flag: configuration.flag });
  }

  private async poll() {
    await this.loadFlagConfigurations();
    setTimeout(() => {
      this.poll();
    }, this.options.pollInterval);
  }

  private async loadFlagConfigurations() {
    const url = new URL("/flag-configurations", this.options.apiHost);
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.options.secretKey}`,
        "Content-Type": "application/json",
      },
    });

    this.flagConfigurations = await res.json();
  }
}
