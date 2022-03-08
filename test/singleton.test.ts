import nock from "nock";
import { describe, expect, spyOn, test } from "vitest";
import bucketSingleton from "../src/lib";

describe("singleton", () => {
  test("an instance is exported", () => {
    expect(bucketSingleton.init).toBeDefined();
  });
});
