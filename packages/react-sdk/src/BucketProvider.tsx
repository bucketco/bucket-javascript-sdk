"use client";

import React from "react";

import { BucketClient } from "@bucketco/browser-sdk";
import {
  BucketClientConfigured,
  FeatureDefs,
  FeatureKey,
} from "@bucketco/browser-sdk/configuredClient";

import {
  BaseBucketProvider,
  BucketProps,
  useFeature as baseUseFeature,
} from "./BaseBucketProvider";

export {
  useUpdateCompany,
  useUpdateOtherContext,
  useUpdateUser,
} from "./BaseBucketProvider";
export type { FeatureKey } from "@bucketco/browser-sdk/configuredClient";

export const BucketProvider = (props: BucketProps) => (
  <BaseBucketProvider
    {...props}
    newBucketClient={
      props.newBucketClient
        ? (opts) => props.newBucketClient!(opts)
        : // BucketClientConfigured will come with the "features" already loaded in
          (opts) => new BucketClientConfigured(opts) as BucketClient
    }
  />
);

export function useFeature<Key extends FeatureKey>(key: Key) {
  return baseUseFeature<Key, FeatureDefs>(key);
}
