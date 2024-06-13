import fetch from "cross-fetch";
import bucket, { Options } from "@bucketco/tracking-sdk";
import { FlagData, evaluateFlag } from "@bucketco/flag-evaluation";

import { version } from "../package.json";
import { Feedback } from "@bucketco/tracking-sdk/dist/types/src/types"; // TODO: fix import

type Key = string;
type FlagConfiguration = {
  key: string;
  flag: FlagData;
};

type Context = {
  active?: boolean;
};

export default {
  /**
   * Initialize the Bucket SDK.
   *
   * Must be called before calling other SDK methods.
   *
   * @param key Your Bucket publishable key
   * @param options
   */
  init: (key: Key, options: Options = {}) => bucket.init(key, options),
  version: version,
  /**
   * Track an event in Bucket.
   *
   * @param eventName The name of the event
   * @param attributes Any attributes you want to attach to the event
   * @param options.userId The ID you use to identify the current user
   * @param options.companyId The ID you use to identify the current user's company
   * @param options.context
   */
  track: (
    eventName: string,
    attributes: Record<string, any> | null,
    options: {
      userId: string;
      companyId: string;
      context?: Context;
    },
  ) =>
    bucket.track(
      eventName,
      attributes,
      options.userId,
      options.companyId,
      options.context,
    ),
  /**
   * Submit user feedback to Bucket. Must include either `score` or `comment`, or both.
   *
   * @param options
   * @returns
   */
  feedback: (feedback: Feedback) => bucket.feedback(feedback),
};

// TODO: should this be exported, or a key on the `bucket` default export?
export class Evaluator {
  constructor(
    private options: {
      secretKey: string; // TODO: accept via bucket.init call instead?
      appId: string; // TODO: needed or secret key enough?
      envId: string; // TODO: needed or secret key enough?
    },
  ) {}

  async getFlags(context: Record<string, unknown>) {
    // TODO: consider flag events

    const configurations = await this.flagConfigurations();
    const results = await Promise.all(
      configurations.map(async (configuration) => {
        return await evaluateFlag({ context, flag: configuration.flag });
      }),
    );

    return results.reduce((acc, result) => {
      return { ...acc, [result.key]: result };
    }, {});
  }

  async getFlag(context: Record<string, unknown>, key: string) {
    const configurations = await this.flagConfigurations();
    const configuration = configurations.find((c) => c.key === key);
    if (!configuration) {
      // TODO: what?
      return null;
    }

    return await evaluateFlag({ context, flag: configuration.flag });
  }

  private async flagConfigurations(): Promise<FlagConfiguration[]> {
    // TODO: cache

    const res = await fetch("https://in.bucket.co/flag-configurations", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secretKey: this.options.secretKey,
        appId: this.options.appId,
        envId: this.options.envId,
      }),
    });

    return await res.json();
  }
}

// // TODO: document express middleware
// // TODO: get context from here?
// function bucket(evaluator: Evaluator) {
//   return function bucketMiddleware(req: any, _res: any, next: any) {
//     req.locals.__bucket = { evaluator };
//     next();
//   };
// }

// function getFlags(req: any) {
//   const evaluator = req.locals?.__bucket?.evaluator;
//   if (evaluator === undefined) {
//     console.error(""); // how best to handle
//   }

//   return evaluator.getFlags();
// }

// function getFlag(req: any, key: string) {
//   const evaluator = req.locals?.__bucket?.evaluator;
//   if (evaluator === undefined) {
//     console.error(""); // how best to handle
//   }

//   return evaluator.getFlag(key);
// }
