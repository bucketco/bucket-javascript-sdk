import { describe, it, expect } from "vitest";
import { FeatureDef, genDTS } from "./gen.js";

describe("genFeatureTypes", () => {
  const features: FeatureDef[] = [
    { key: "feat-1", access: true, config: undefined },
    { key: "FEAT URE2", access: false, config: "string" },
    {
      key: "feature3",
      access: true,
      config: {
        aiModel: "string",
        prompt: "string",
      },
    },
  ];

  it("should generate correct TypeScript output for browser", () => {
    const output = genDTS(features);
    expect(output).toMatchSnapshot();
  });

  it("should generate correct TypeScript output for react", () => {
    const output = genDTS(features);
    expect(output).toMatchSnapshot();
  });
});
