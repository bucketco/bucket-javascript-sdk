import { describe, it, expect } from "vitest";

import { ConfigFeatureDefs } from "../utils/config.js";
import { genFeatureTypes } from "./features.js";

describe("genFeatureTypes", () => {
  const features: ConfigFeatureDefs = [
    "feature1",
    { key: "feature2", access: false, config: "string" },
    {
      key: "feature3",
      config: {
        aiModel: "string",
        prompt: {
          text: "string",
          cheekyFactor: "number",
        },
      },
    },
  ];

  it("should generate correct TypeScript output for browser", () => {
    const output = genFeatureTypes("browser", features);
    expect(output).toMatchSnapshot();
  });

  it("should generate correct TypeScript output for react", () => {
    const output = genFeatureTypes("react", features);
    expect(output).toMatchSnapshot();
  });
});
