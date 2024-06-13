import fetch from "cross-fetch";
import bucket from "@bucketco/tracking-sdk";
import { FlagData, evaluateFlag } from "@bucketco/flag-evaluation";

type FlagConfiguration = {
  key: string;
  flag: FlagData;
};

export default bucket;

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
