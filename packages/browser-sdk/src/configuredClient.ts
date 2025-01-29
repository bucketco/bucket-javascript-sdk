// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - doesn't exist when building this package
import { generatedFeatures, GeneratedFeatureTypes } from "_bucket";

import { BucketClient, InitOptions } from "./client";

export type FeatureKey = Extract<keyof GeneratedFeatureTypes, string>;

export class BucketClientConfigured extends BucketClient<GeneratedFeatureTypes> {
  constructor(opts: InitOptions) {
    super({
      features: generatedFeatures,
      ...opts,
    });
  }
}
