import { BucketClient } from "@bucketco/node-sdk";

export const bucket = new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY || "",
});

await bucket.initialize();
console.log("Bucket initialized");
