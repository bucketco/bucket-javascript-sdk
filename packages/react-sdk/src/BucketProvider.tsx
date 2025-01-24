import React from "react";
// @ts-ignore
import { generatedFeatures, GeneratedFeatureTypes } from "_bucket";

import {
  BaseBucketProvider,
  BucketProps,
  useFeature as baseUseFeature,
} from "./BaseBucketProvider";

export type FeatureKey = keyof GeneratedFeatureTypes;

export const BucketProvider = (props: BucketProps) => (
  <BaseBucketProvider {...props} features={generatedFeatures} />
);
export const useFeature = (key: FeatureKey) => baseUseFeature(key as string);
