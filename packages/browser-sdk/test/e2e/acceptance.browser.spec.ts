import { randomUUID } from "crypto";
import { expect, test } from "@playwright/test";

const KEY = randomUUID();

test("Acceptance", async ({ page }) => {
  await page.goto("http://localhost:8000/test/e2e/empty.html");

  const successfulRequests: string[] = [];

  // Mock API calls with assertions
  await page.route(`https://front.bucket.co/user`, async (route) => {
    expect(route.request().method()).toEqual("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: "foo",
      attributes: {
        name: "new user name",
      },
    });

    successfulRequests.push("USER");
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route(`https://front.bucket.co/company`, async (route) => {
    expect(route.request().method()).toEqual("POST");
    expect(route.request().postDataJSON()).toMatchObject({
      userId: "foo",
      companyId: "bar",
      attributes: {
        name: "new company name",
      },
    });

    successfulRequests.push("COMPANY");
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ success: true }),
    });
  });

  await page.route(`https://front.bucket.co/event`, async (route) => {
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

  await page.route(`https://front.bucket.co/feedback`, async (route) => {
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

  // Load the built Bucket SDK
  await page.addScriptTag({
    url: "http://localhost:8000/dist/bucket-browser-sdk.js",
  });

  // Golden path requests
  await page.evaluate(`
    ;(async () => {
      const bucketClient = new window.BucketClient("${KEY}", {
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
      await bucketClient.user({ name: "new user name" });
      await bucketClient.company({ name: "new company name" });
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
  expect(successfulRequests).toEqual(["USER", "COMPANY", "EVENT", "FEEDBACK"]);
});
