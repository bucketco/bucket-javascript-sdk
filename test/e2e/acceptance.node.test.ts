// @vitest-environment node
import { randomUUID } from "crypto";
import nock from "nock";
import { beforeEach, expect, test } from "vitest";

import bucket from "../../";

const KEY = randomUUID();

beforeEach(() => nock.cleanAll());

test("Acceptance", async () => {
  nock(`https://tracking.bucket.co/${KEY}`)
    .post(/.*\/user/, {
      userId: "foo",
      attributes: {
        name: "john doe",
      },
    })
    .reply(200);
  nock(`https://tracking.bucket.co/${KEY}`)
    .post(/.*\/company/, {
      userId: "foo",
      companyId: "bar",
      attributes: {
        name: "bar corp",
      },
    })
    .reply(200);
  nock(`https://tracking.bucket.co/${KEY}`)
    .post(/.*\/event/, {
      userId: "foo",
      companyId: "bar",
      event: "baz",
      attributes: {
        baz: true,
      },
    })
    .reply(200);
  nock(`https://tracking.bucket.co/${KEY}`)
    .post(/.*\/feedback/, {
      userId: "foo",
      companyId: "bar",
      featureId: "featureId1",
      score: 5,
      comment: "test!",
      source: "sdk",
    })
    .reply(200);

  bucket.init(KEY, {});
  await bucket.user("foo", { name: "john doe" });
  await bucket.company("bar", { name: "bar corp" }, "foo");
  await bucket.track("baz", { baz: true }, "foo", "bar");
  await bucket.feedback({
    featureId: "featureId1",
    userId: "foo",
    companyId: "bar",
    score: 5,
    comment: "test!",
  });

  expect(nock.isDone()).toBeTruthy();
});
