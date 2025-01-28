// @ts-expect-error
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
