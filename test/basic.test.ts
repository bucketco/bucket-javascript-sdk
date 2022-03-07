import { assert, expect, test } from "vitest";
import { testing } from "../src/main";

test("is true", () => {
  expect(testing()).toBe(true);
});
