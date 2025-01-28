declare module "canonical-json";

declare module "_bucket" {
  import { RawFeature } from "@bucketco/browser-sdk";
  //   export const generatedFeatures: string[];
  export type GeneratedFeatureTypes = Record<string, RawFeature>;
}
