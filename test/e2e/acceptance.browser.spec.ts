import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

const KEY = randomUUID();

test("Acceptance", async ({ page }) => {
  const successfulRequests: string[] = [];

  // Mock API calls with assertions
  await page.route(`https://tracking.bucket.co/${KEY}/user`, async (route) => {
    expect(route.request().method()).toEqual("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: "foo",
      attributes: {
        name: "john doe",
      },
    });

    successfulRequests.push("USER");
    await route.fulfill({ status: 200 });
  });

  await page.route(
    `https://tracking.bucket.co/${KEY}/company`,
    async (route) => {
      expect(route.request().method()).toEqual("POST");
      expect(route.request().postDataJSON()).toMatchObject({
        userId: "foo",
        companyId: "bar",
        attributes: {
          name: "bar corp",
        },
      });

      successfulRequests.push("COMPANY");
      await route.fulfill({ status: 200 });
    },
  );

  await page.route(`https://tracking.bucket.co/${KEY}/event`, async (route) => {
    expect(route.request().method()).toEqual("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: "foo",
      companyId: "bar",
      event: "baz",
      attributes: {
        baz: true,
      },
    });

    successfulRequests.push("EVENT");
    await route.fulfill({ status: 200 });
  });

  await page.route(
    `https://tracking.bucket.co/${KEY}/feedback`,
    async (route) => {
      expect(route.request().method()).toEqual("POST");
      expect(route.request().postDataJSON()).toMatchObject({
        userId: "foo",
        companyId: "bar",
        featureId: "featureId1",
        score: 5,
        comment: "test!",
        question: "actual question",
        promptedQuestion: "prompted question",
      });

      successfulRequests.push("FEEDBACK");
      await route.fulfill({ status: 200 });
    },
  );

  // Load the built Bucket SDK
  await page.addScriptTag({
    url: "http://localhost:8000/dist/bucket-tracking-sdk.browser.js",
  });

  // Golden path requests
  await page.evaluate(`
    ;(async () => {
      bucket.init("${KEY}", {});
      await bucket.user("foo", { name: "john doe" });
      await bucket.company("bar", { name: "bar corp" }, "foo");
      await bucket.track("baz", { baz: true }, "foo", "bar");
      await bucket.feedback({
        featureId: "featureId1",
        userId: "foo",
        companyId: "bar",
        score: 5,
        comment: "test!",
        question: "actual question",
        promptedQuestion: "prompted question",
      });
    })()
  `);

  // Assert all API requests were made
  expect(successfulRequests).toEqual(["USER", "COMPANY", "EVENT", "FEEDBACK"]);
});
