import { BucketClient } from "../../src";

// Extending the Features interface to define the available features
declare module "../src/types" {
  interface Features {
    "show-todos": boolean;
    "create-todos": boolean;
    "delete-todos": boolean;
  }
}

if (!process.env.BUCKET_SECRET_KEY) {
  throw new Error("BUCKET_SECRET_KEY is required");
}

// Create a new BucketClient instance with the secret key and default features
// The default features will be used if the user does not have any features set
export default new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY!,
  fallbackFeatures: ["show-todos"], // typed checked at compile time
  // Optional: Set a logger to log debug information, errors, etc.
  logger: console,
});
