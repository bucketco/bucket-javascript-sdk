import chalk from "chalk";
import {
  ConfigFeatureDefs,
  readConfigFile,
  writeConfigFile,
} from "../utils/config.js";
import { FeatureDef, genDTS, OutputType } from "../utils/gen.js";
import { outputFile } from "fs-extra";

export async function genFeatureTypes(
  outputType: OutputType,
  configFeatures: ConfigFeatureDefs,
) {
  const features = configFeatures.map((feature) => ({
    key: typeof feature === "string" ? feature : feature.key,
    access: typeof feature === "string" ? true : (feature.access ?? true),
    config: typeof feature === "string" ? undefined : feature.config,
  }));

  const generatedTypes = genDTS(outputType, features);
  await outputFile(`node_modules/.bucket/generated`, generatedTypes);
  console.log(chalk.green("Updated typed features."));
}

export async function addFeatureToConfig(feature: FeatureDef) {
  const config = await readConfigFile();

  if (feature.access && feature.config === undefined)
    config.features.push(feature.key);
  else config.features.push(feature);

  await writeConfigFile(config);
}
