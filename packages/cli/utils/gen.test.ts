import { describe, expect, it } from "vitest";

import { FeatureDef } from "./config.js";
import { genDTS, genJs } from "./gen.js";

describe("genFeatureTypes", () => {
  const features: FeatureDef[] = [
    { key: "feat-1", access: true, configType: undefined },
    { key: "FEAT URE2", access: false, configType: "string" },
    {
      key: "feature3",
      access: true,
      configType: {
        aiModel: "string",
        prompt: "string",
      },
      fallback: {
        isEnabled: true,
        config: {
          type: "number", // this will trip up a simple output writer
          aiModel: "gtp3.5-turbo",
          prompt: "Explain in conversational language",
        },
      },
    },
  ];

  it("should generate correct TypeScript declaration", () => {
    const output = genDTS(features);
    expect(output).toMatchSnapshot();
  });

  it("should generate correct javascript file", () => {
    const output = genJs(features);
    expect(output).toMatchSnapshot();
  });
});
