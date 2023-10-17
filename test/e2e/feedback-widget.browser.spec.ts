import { randomUUID } from "crypto";
import { expect, Locator, Page, Request, test } from "@playwright/test";
import { DEFAULT_TRANSLATIONS } from "../../src/feedback/config/defaultTranslations";

import {
  feedbackContainerId,
  propagatedEvents,
} from "../../src/feedback/constants";

const KEY = randomUUID();
const TRACKING_HOST = `https://tracking.bucket.co`;

declare global {
  interface Window {
    eventsFired: Record<string, boolean>;
  }
}

function pick<T>(options: T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

async function getOpenedWidgetContainer(page: Page) {
  // Mock API calls
  // TODO: mock every call
  await page.route(`${TRACKING_HOST}/${KEY}/user`, async (route) => {
    await route.fulfill({ status: 200 });
  });

  // Load the built Bucket SDK
  await page.addScriptTag({
    url: "http://localhost:8000/dist/bucket-tracking-sdk.browser.js",
  });

  // Golden path requests
  await page.evaluate(`
    ;(async () => {
      bucket.init("${KEY}", {});
      await bucket.user('foo')
      await bucket.requestFeedback({
        featureId: "featureId1",
        userId: "foo",
        companyId: "bar",
        title: "baz"
      });
    })()
  `);

  return page.locator(`#${feedbackContainerId}`);
}

async function setScore(container: Locator, score: number) {
  await container
    .locator(`#bucket-feedback-score-${score}`)
    .dispatchEvent("click");
}

async function setComment(container: Locator, comment: string) {
  await container.locator("#bucket-feedback-comment-label").fill(comment);
}

async function submitForm(container: Locator) {
  await container.locator(".form-expanded-content").getByRole("button").click();
}

// // Use this for debug
// test.beforeEach(({ page, browserName }) => {
//   page.on("request", (request) =>
//     console.info(`[${browserName}]`, ">>", request.method(), request.url()),
//   );

//   page.on("response", (response) =>
//     console.info(`[${browserName}]`, "<<", response.status(), response.url()),
//   );
// });

test("Opens a feedback widget", async ({ page }) => {
  const container = await getOpenedWidgetContainer(page);

  await expect(container).toBeAttached();
  await expect(container.locator("dialog")).toHaveAttribute("open", "");
});

test("Sends a request when choosing a score immediately", async ({ page }) => {
  const expectedScore = pick([1, 2, 3, 4, 5]);
  let sentJSON: object | null = null;

  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    sentJSON = route.request().postDataJSON();
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove
  await setScore(container, expectedScore);

  expect(sentJSON).toEqual({
    companyId: "bar",
    featureId: "featureId1",
    score: expectedScore,
    userId: "foo",
  });
});

test("Shows a success message after submitting a score", async ({ page }) => {
  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove

  await expect(container).toContainText(
    DEFAULT_TRANSLATIONS.ScoreStatusDescription,
  );
  await expect(container).not.toContainText(
    DEFAULT_TRANSLATIONS.ScoreStatusReceived,
  );

  await setScore(container, 3);

  await expect(container).not.toContainText(
    DEFAULT_TRANSLATIONS.ScoreStatusDescription,
  );
  await expect(container).toContainText(
    DEFAULT_TRANSLATIONS.ScoreStatusReceived,
  );
});

test("Updates the score on every change", async ({ page }) => {
  let lastSentJSON: object | null = null;

  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    lastSentJSON = route.request().postDataJSON();
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove

  await setScore(container, 1);
  await setScore(container, 5);
  await setScore(container, 3);
  await new Promise((resolve) => setTimeout(resolve, 10)); // TODO: remove

  expect(lastSentJSON).toEqual({
    companyId: "bar",
    featureId: "featureId1",
    score: 3,
    userId: "foo",
  });
});

test("Shows the comment field after submitting a score", async ({ page }) => {
  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove

  await expect(
    container.locator("#bucket-feedback-comment-label"),
  ).not.toBeVisible();

  await setScore(container, 1);

  await expect(
    container.locator("#bucket-feedback-comment-label"),
  ).toBeVisible();
});

test("Sends a request with both the score and comment when submitting", async ({
  page,
}) => {
  const expectedComment = `This is my comment: ${Math.random()}`;
  const expectedScore = pick([1, 2, 3, 4, 5]);

  let sentJSON: object | null = null;

  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    sentJSON = route.request().postDataJSON();
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove

  await setScore(container, expectedScore);
  await setComment(container, expectedComment);
  await submitForm(container);

  expect(sentJSON).toEqual({
    comment: expectedComment,
    score: expectedScore,
    companyId: "bar",
    featureId: "featureId1",
    userId: "foo",
  });
});

test("Shows a success message after submitting", async ({ page }) => {
  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove

  await setScore(container, 3);
  await setComment(container, "Test comment!");
  await submitForm(container);

  await new Promise((resolve) => setTimeout(resolve, 300)); // TODO: remove

  expect(
    container.getByText(DEFAULT_TRANSLATIONS.SuccessMessage),
  ).toBeVisible();
});

test("Closes the dialog shortly after submitting", async ({ page }) => {
  await page.route(`${TRACKING_HOST}/${KEY}/feedback`, async (route) => {
    await route.fulfill({ status: 200 });
  });

  const container = await getOpenedWidgetContainer(page);
  await new Promise((resolve) => setTimeout(resolve, 100)); // TODO: remove

  await setScore(container, 3);
  await setComment(container, "Test comment!");
  await submitForm(container);

  await new Promise((resolve) => setTimeout(resolve, 500)); // TODO: remove, fake?

  await expect(container.locator("dialog")).not.toHaveAttribute("open", "");
});

test("Blocks event propagation to the containing document", async ({
  page,
}) => {
  const container = await getOpenedWidgetContainer(page);
  const textarea = container.locator('textarea[name="comment"]');

  await page.evaluate(
    ({ trackedEvents }) => {
      window.eventsFired = {};

      for (const event of trackedEvents) {
        document.addEventListener(event, () => {
          window.eventsFired[event] = true;
        });
      }
    },
    { trackedEvents: propagatedEvents },
  );

  await textarea.focus();
  // Fires 'keydown', 'keyup' and 'keypress' events
  await page.keyboard.type("Hello World");

  const firedEvents = await page.evaluate(() => {
    return window.eventsFired;
  });

  // No events are allowed to fire, object should be empty
  expect(firedEvents).toEqual({});
});
