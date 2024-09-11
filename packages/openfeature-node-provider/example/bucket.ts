import { OpenFeature } from "@openfeature/server-sdk";
import { BucketNodeProvider } from "../src";

if (!process.env.BUCKET_SECRET_KEY) {
  throw new Error("BUCKET_SECRET_KEY is required");
}

const provider = new BucketNodeProvider({
  secretKey: process.env.BUCKET_SECRET_KEY!,
  fallbackFeatures: ["show-todos"],
  logger: console,
});
OpenFeature.setProvider(provider);

export default provider;
