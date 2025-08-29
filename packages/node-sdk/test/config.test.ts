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
      featureOverrides: {
        "flag-1": { isEnabled: true },
        "flag-2": false,
        "flag-3": {
          isEnabled: true,
          config: {
            key: "config-1",
            payload: { something: "else" },
          },
        },
      },
      secretKey: "mySecretKey",
      offline: true,
      apiBaseUrl: "http://localhost:3000",
    });
  });

  it("should load ENV variables (deprecated)", () => {
    process.env.BUCKET_SECRET_KEY = "mySecretKeyFromEnv";
    process.env.BUCKET_OFFLINE = "true";
    process.env.BUCKET_API_BASE_URL = "http://localhost:4999";
    process.env.BUCKET_FEATURES_ENABLED = "flag-1,flag-2";
    process.env.BUCKET_FEATURES_DISABLED = "flag-3,flag-4";

    const config = loadConfig();
    expect(config).toEqual({
      featureOverrides: {},
      flagOverrides: {
        "flag-1": true,
        "flag-2": true,
        "flag-3": false,
        "flag-4": false,
      },
      secretKey: "mySecretKeyFromEnv",
      offline: true,
      apiBaseUrl: "http://localhost:4999",
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
      featureOverrides: {
        "flag-1": { isEnabled: true },
        "flag-2": false,
        "flag-3": {
          isEnabled: true,
          config: {
            key: "config-1",
            payload: { something: "else" },
          },
        },
      },
      secretKey: "mySecretKeyFromEnv",
      offline: true,
      apiBaseUrl: "http://localhost:4999",
    });
  });
});
