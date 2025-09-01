import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config";

describe("config tests", () => {
  it("should load config file", () => {
    const config = loadConfig("test/testConfig.json");

    expect(config).toEqual({
      featureOverrides: {
        myFlag: {
          isEnabled: true,
        },
        myFlagFalse: false,
        myFlagWithConfig: {
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

  it("should load ENV VARS", () => {
    process.env.BUCKET_SECRET_KEY = "mySecretKeyFromEnv";
    process.env.BUCKET_OFFLINE = "true";
    process.env.BUCKET_HOST = "http://localhost:4999";
    process.env.BUCKET_FEATURES_ENABLED = "myNewFlag";
    process.env.BUCKET_FEATURES_DISABLED = "myNewFlagFalse";

    const config = loadConfig("test/testConfig.json");
    expect(config).toEqual({
      featureOverrides: {
        myFlag: {
          isEnabled: true,
        },
        myFlagFalse: false,
        myNewFlag: true,
        myNewFlagFalse: false,
        myFlagWithConfig: {
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
