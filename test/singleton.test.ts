import { describe, expect, test } from "vitest";

import bucketSingleton from "../src";

describe("singleton", () => {
  test("an instance is exported", () => {
    expect(bucketSingleton.init).toBeDefined();
  });
});
