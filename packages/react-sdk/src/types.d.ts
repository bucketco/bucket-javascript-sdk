declare module "canonical-json";

declare module "_bucket" {
  import { FeatureDef } from "@bucketco/browser-sdk";

  export type GeneratedFeatureTypes = Record<string, FeatureDef>;
}
