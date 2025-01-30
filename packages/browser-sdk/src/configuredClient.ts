// without the `type` keyword explicit here, the `type` keyword doesn't appear
// in the generated declaration file which breaks importing the generated
// feature type from "_bucket".
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - doesn't exist when building this package
import type { GeneratedFeatureTypes } from "_bucket";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - doesn't exist when building this package
// eslint-disable-next-line import/no-unresolved
import { generatedFeatures } from "_bucket";

import { BucketClient, InitOptions } from "./client";

export type FeatureKey = Extract<keyof GeneratedFeatureTypes, string>;
export type FeatureDefs = GeneratedFeatureTypes;

export class BucketClientConfigured extends BucketClient<GeneratedFeatureTypes> {
  constructor(opts: InitOptions) {
    super({
      featureList: generatedFeatures,
      ...opts,
    });
  }
}
