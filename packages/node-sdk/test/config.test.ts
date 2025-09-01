import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config";

describe("config tests", () => {
  it("should load config file", () => {
    const config = loadConfig("test/testConfig.json");

    expect(config).toEqual({
      flagOverrides: {
        "flag-4": true,
        "flag-5": false,
        "flag-6": { key: "config-2", payload: { something: "else entirely" } },
      },
      secretKey: "mySecretKey",
      offline: true,
      apiBaseUrl: "http://localhost:3000",
    });
  });

  it("should load ENV variables", () => {
    process.env.REFLAG_SECRET_KEY = "mySecretKeyFromEnv";
    process.env.REFLAG_OFFLINE = "true";
    process.env.REFLAG_API_BASE_URL = "http://localhost:4999";
    process.env.REFLAG_FLAGS_ENABLED = "flag-5,flag-7";
    process.env.REFLAG_FLAGS_DISABLED = "flag-4,flag-8";

    const config = loadConfig("test/testConfig.json");
    expect(config).toEqual({
      flagOverrides: {
        "flag-4": false,
        "flag-5": true,
        "flag-6": { key: "config-2", payload: { something: "else entirely" } },
        "flag-7": true,
        "flag-8": false,
      },
      secretKey: "mySecretKeyFromEnv",
      offline: true,
      apiBaseUrl: "http://localhost:4999",
    });
  });
});
