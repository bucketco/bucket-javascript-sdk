import { randomUUID } from "crypto";
import { expect, Page, test } from "@playwright/test";

import {
  feedbackContainerId,
  propagatedEvents,
} from "../../src/feedback/constants";

const KEY = randomUUID();

declare global {
  interface Window {
    eventsFired: Record<string, boolean>;
  }
}

async function getOpenedWidgetContainer(page: Page) {
  // Mock API calls
  await page.route(`https://tracking.bucket.co/${KEY}/user`, async (route) => {
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

test("Opens a feedback widget", async ({ page }) => {
  const container = await getOpenedWidgetContainer(page);

  await expect(container).toBeAttached();
  await expect(container.locator("dialog")).toHaveAttribute("open", "");
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
