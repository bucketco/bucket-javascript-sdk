"use client";

import { BucketBrowserSDKProvider } from "@bucketco/openfeature-browser-provider";
import { OpenFeature } from "@openfeature/react-sdk";

const publishableKey = process.env.NEXT_PUBLIC_BUCKET_PUBLISHABLE_KEY;

let bucketProvider: BucketBrowserSDKProvider | null = null;
let initialized = false;

export async function initOpenFeature() {
  if (initialized) {
    return;
  }
  initialized = true;

  if (!publishableKey) {
    console.error("No publishable key set for Bucket");
    return;
  }
  bucketProvider = new BucketBrowserSDKProvider({ publishableKey });
  return OpenFeature.setProviderAndWait(bucketProvider);
}

export function track(event: string, attributes?: { [key: string]: any }) {
  console.log("Tracking event", event, attributes);
  bucketProvider?.client?.track(event, attributes);
}
