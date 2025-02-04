import { readFile } from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

import { FeatureDef } from "../utils/config.js";

import { generatePackagedConfig } from "./features.js";

describe("genFeatureTypes", () => {
  const features: FeatureDef[] = [
    { key: "feature1" },
    { key: "feature2", access: false, configType: "string" },
    {
      key: "feature3",
      configType: {
        aiModel: "string",
        prompt: {
          text: "string",
          cheekyFactor: "number",
        },
      },
      fallback: {
        isEnabled: true,
        config: {
          cheekyFactorType: "number", // this will trip up a simple output writer
          aiModel: "gpt3",
          prompt: {
            text: "Explain in conversational language",
            cheekyFactor: 0.5,
          },
        },
      },
    },
  ];

  it("should generate correct TypeScript output for browser", async () => {
    const outputDir = "test/gen";
    await generatePackagedConfig(features, outputDir);
    const dtsOutput = await readFile(
      path.join(outputDir, "_bucket/index.d.ts"),
      "utf-8",
    );
    expect(dtsOutput).toMatchSnapshot("index.d.ts");

    const jsOutput = await readFile(
      path.join(outputDir, "_bucket/index.js"),
      "utf-8",
    );
    expect(jsOutput).toMatchSnapshot("index.d.ts");

    const packageJsonOutput = await readFile(
      path.join(outputDir, "_bucket/package.json"),
      "utf-8",
    );
    expect(packageJsonOutput).toMatchSnapshot("index.d.ts");
  });
});
