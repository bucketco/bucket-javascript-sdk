import { describe, it, expect } from "vitest";
import { genDTS } from "./gen.js";
import { ConfigFeatureDefs } from "./config.js";

describe("genFeatureTypes", () => {
  const features: ConfigFeatureDefs = [
    "feature1",
    { key: "feature2", access: false, config: "string" },
    {
      key: "feature3",
      config: {
        aiModel: "string",
        prompt: "string",
      },
    },
  ];

  it("should generate correct TypeScript output for browser", () => {
    const output = genDTS("browser", features);
    expect(output).toMatchSnapshot();
  });

  it("should generate correct TypeScript output for react", () => {
    const output = genDTS("react", features);
    expect(output).toMatchSnapshot();
  });
});
