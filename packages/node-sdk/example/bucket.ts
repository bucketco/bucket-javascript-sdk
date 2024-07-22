import { BucketClient } from "@bucketco/node-sdk/src";

// Extending the Flags interface to define the available flags
declare module "." {
  interface Flags {
    huddle: boolean;
  }
}

export const bucket = new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY || "sec_prod_12345678901234567890",
  fallbackFlags: {
    "show-todos": true,
  },
  logger: console,
});

bucket.initialize().then(() => {
  console.log("Bucket initialized");
});
