import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config";

describe("config tests", () => {
  it("should load config file", () => {
    const config = loadConfig("test/testConfig.json");

    expect(config).toEqual({
      featureOverrides: {
        myFeature: {
          isEnabled: true,
        },
        myFeatureFalse: false,
        myFeatureWithConfig: {
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
    process.env.BUCKET_FEATURES_ENABLED = "myNewFeature";
    process.env.BUCKET_FEATURES_DISABLED = "myNewFeatureFalse";

    const config = loadConfig("test/testConfig.json");
    expect(config).toEqual({
      featureOverrides: {
        myFeature: {
          isEnabled: true,
        },
        myFeatureFalse: false,
        myNewFeature: true,
        myNewFeatureFalse: false,
        myFeatureWithConfig: {
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
