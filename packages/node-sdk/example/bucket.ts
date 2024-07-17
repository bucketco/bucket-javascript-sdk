import { BucketClient } from "../src";

export const bucket = new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY || "",
});
