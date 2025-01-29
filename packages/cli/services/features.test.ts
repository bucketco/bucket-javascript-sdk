import { describe, it, expect } from "vitest";

import { ConfigFeatureDefs } from "../utils/config.js";
import { genFeatureTypes } from "./features.js";
import { readFile } from "fs/promises";
import path from "path";

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

  it("should generate correct TypeScript output for browser", async () => {
    const outputDir = "test/gen";
    await genFeatureTypes(features, outputDir);
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
