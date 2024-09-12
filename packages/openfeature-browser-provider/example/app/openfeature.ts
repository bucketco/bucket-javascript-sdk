"use client";

import { BucketBrowserSDKProvider } from "@bucketco/openfeature-browser-provider";
import { OpenFeature, OpenFeatureProvider } from "@openfeature/react-sdk";

const publishableKey = process.env.NEXT_PUBLIC_BUCKET_PUBLISHABLE_KEY;

if (!publishableKey) {
  console.error("No publishable key set for Bucket");
} else {
  const bucketProvider = new BucketBrowserSDKProvider({ publishableKey });
  OpenFeature.setProvider(bucketProvider);
}
