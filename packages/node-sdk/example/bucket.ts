import { BucketClient, Context } from "../src";
import { FeatureOverrides } from "../src/types";

// Extending the Features interface to define the available features
declare module "../src/types" {
  interface Features {
    "show-todos": boolean;
    "create-todos": boolean;
    "delete-todos": boolean;
  }
}

let featureOverrides = (context: Context): FeatureOverrides => {
  return { "delete-todos": true }; // feature keys checked at compile time
};

let host = undefined;
if (process.env.BUCKET_HOST) {
  host = process.env.BUCKET_HOST;
}

// Create a new BucketClient instance with the secret key and default features
// The default features will be used if the user does not have any features set
// Create a bucketConfig.json file to configure the client or set environment variables
// like BUCKET_SECRET_KEY, BUCKET_FEATURES_ENABLED, BUCKET_FEATURES_DISABLED, etc.
export default new BucketClient({
  // Optional: Set a logger to log debug information, errors, etc.
  logger: console,
  featureOverrides, // Optional: Set feature overrides
});
