import { BucketClient } from "../src";

// Extending the Flags interface to define the available flags
declare module "../src/types" {
  interface Flags {
    "show-todos": boolean;
    "create-todos": boolean;
    "delete-todos": boolean;
  }
}

if (!process.env.BUCKET_SECRET_KEY) {
  throw new Error("BUCKET_SECRET_KEY is required");
}

// Create a new BucketClient instance with the secret key and default flags
// The default flags will be used if the user does not have any flags set
export default new BucketClient({
  secretKey: process.env.BUCKET_SECRET_KEY!,
  fallbackFlags: {
    "show-todos": true,
    "create-todos": false,
    "delete-todos": false,
  },
  // Optional: Set a logger to log debug information, errors, etc.
  logger: console,
});
