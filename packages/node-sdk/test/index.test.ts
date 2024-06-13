import nock from "nock";
import { Flags, Flag } from "@bucketco/tracking-sdk";
import Bucket, { BucketOptions, FlagEvaluator } from "../src/index2";

describe("Bucket", () => {
  describe("#track", () => {
    it.each([null, undefined, ""])(
      "fails when missing an eventName",
      async (eventName) => {
        const bucket = subject();
        await expect(async () => {
          return bucket.track(eventName as any, {} as any);
        }).rejects.toThrow("'eventName' must be provided");
      },
    );

    it.each([
      {},
      { userId: "" },
      { companyId: "" },
      { userId: "", companyId: "" },
      { userId: undefined },
      { companyId: undefined },
      { userId: undefined, companyId: undefined },
      { userId: null },
      { companyId: null },
      { userId: null, companyId: null },
    ])("fails when missing userId or companyId", async (options) => {
      const bucket = subject();
      await expect(async () => {
        return bucket.track("event", options as any);
      }).rejects.toThrow("'userId' and 'companyId' must be provided");
    });

    it("sends a tracking event to Bucket", async () => {
      const key = Math.random().toString();
      const eventName = Math.random().toString();
      const userId = Math.random().toString();
      const companyId = Math.random().toString();

      const bucket = subject({ publishableKey: key });

      nock(`https://test.example.com/${key}`)
        .post(/.*\/event/, {
          event: eventName,
          userId: userId,
          companyId: companyId,
          attributes: {},
          context: {}, // TODO: test
        })
        .reply(200);

      await bucket.track(eventName, {
        userId,
        companyId,
        attributes: {},
        context: {},
      });
    });
  });
});

function subject(options: Partial<BucketOptions> = {}) {
  return new Bucket({
    publishableKey: "pub_123",
    secretKey: "sec_123",
    apiHost: "https://test.example.com",
    evaluator: new OfflineFlagEvaluator(),
    ...options,
  });
}

class OfflineFlagEvaluator implements FlagEvaluator {
  getFlags(_context: Record<string, unknown>): Promise<Flags> {
    throw new Error("Method not implemented.");
  }
  getFlag(
    _key: string,
    _context: Record<string, unknown>,
  ): Promise<Flag | null> {
    throw new Error("Method not implemented.");
  }
}
