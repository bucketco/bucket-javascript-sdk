// @vitest-environment node
import { randomUUID } from "crypto";
import nock from "nock";
import { beforeEach, expect, test } from "vitest";

import bucket from "../../";
import { SDK_VERSION, SDK_VERSION_HEADER_NAME } from "../../src/config";

const KEY = randomUUID();

beforeEach(() => nock.cleanAll());

const nockOpts = {
  reqheaders: {
    [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
    "Content-Type": "application/json",
    Authorization: `Bearer ${KEY}`,
  },
};

test("Acceptance", async () => {
  nock(`https://tracking.bucket.co`)
    .post(
      /.*\/user/,
      {
        userId: "foo",
        attributes: {
          name: "john doe",
        },
      },
      nockOpts,
    )
    .reply(200);

  nock(`https://tracking.bucket.co`)
    .post(
      /.*\/company/,
      {
        userId: "foo",
        companyId: "bar",
        attributes: {
          name: "bar corp",
        },
      },
      nockOpts,
    )
    .reply(200);

  nock(`https://tracking.bucket.co`)
    .post(
      /.*\/event/,
      {
        userId: "foo",
        companyId: "bar",
        event: "baz",
        attributes: {
          baz: true,
        },
      },
      nockOpts,
    )
    .reply(200);

  nock(`https://tracking.bucket.co`)
    .post(
      /.*\/feedback/,
      {
        userId: "foo",
        companyId: "bar",
        featureId: "featureId1",
        score: 5,
        comment: "test!",
        source: "sdk",
      },
      nockOpts,
    )
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
