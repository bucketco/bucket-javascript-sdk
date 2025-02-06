import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

import { API_BASE_URL } from "../../src/constants";

const KEY = randomUUID();

test("Acceptance", async ({ page }) => {
  await page.goto("http://localhost:8001/test/e2e/empty.html");

  const successfulRequests: string[] = [];

  // Mock API calls with assertions
  await page.route(`${API_BASE_URL}/features/enabled*`, async (route) => {
    successfulRequests.push("FEATURES");
    await route.fulfill({
      status: 200,
      body: JSON.stringify({
        success: true,
        features: {},
      }),
    });
  });

  await page.route(`${API_BASE_URL}/user`, async (route) => {
    expect(route.request().method()).toEqual("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: "foo",
      attributes: {
        name: "john doe",
      },
    });

    successfulRequests.push("USER");
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route(`${API_BASE_URL}/company`, async (route) => {
    expect(route.request().method()).toEqual("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: "foo",
      companyId: "bar",
      attributes: {
        name: "bar corp",
      },
    });

    successfulRequests.push("COMPANY");
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route(`${API_BASE_URL}/event`, async (route) => {
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
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route(`${API_BASE_URL}/feedback`, async (route) => {
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
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  // Golden path requests
  await page.evaluate(`
    ;(async () => {
    const { BucketClient } = await import("/dist/bucket-browser-sdk.mjs");
      const bucketClient = new BucketClient({
        publishableKey: "${KEY}",
        user: {
          id: "foo",
          name: "john doe",
        },
        company: {
          id: "bar",
          name: "bar corp",
        }
      });
      await bucketClient.initialize();
      await bucketClient.track("baz", { baz: true }, "foo", "bar");
      await bucketClient.feedback({
        featureId: "featureId1",
        score: 5,
        comment: "test!",
        question: "actual question",
        promptedQuestion: "prompted question",
      });
    })()
  `);

  // Assert all API requests were made
  expect(successfulRequests).toEqual([
    "FEATURES",
    "USER",
    "COMPANY",
    "EVENT",
    "FEEDBACK",
  ]);
});
