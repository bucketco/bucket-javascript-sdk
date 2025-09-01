import { ReflagClient, Context, FeatureOverrides } from "../../";

type CreateConfigPayload = {
  minimumLength: number;
};

// Extending the Features interface to define the available features
declare module "../../types" {
  interface Features {
    "show-todos": boolean;
    "create-todos": {
      config: {
        payload: CreateConfigPayload;
      };
    };
    "delete-todos": boolean;
    "some-else": {};
  }
}

let featureOverrides = (_: Context): FeatureOverrides => {
  return {
    "create-todos": {
      isEnabled: true,
      config: {
        key: "short",
        payload: {
          minimumLength: 10,
        },
      },
    },
  }; // feature keys checked at compile time
};

// Create a new ReflagClient instance with the secret key and default features
// The default features will be used if the user does not have any features set
// Create a reflagConfig.json file to configure the client or set environment variables
// like BUCKET_SECRET_KEY, BUCKET_FEATURES_ENABLED, BUCKET_FEATURES_DISABLED, etc.
export default new ReflagClient({
  // Optional: Set a logger to log debug information, errors, etc.
  logger: console,
  featureOverrides, // Optional: Set feature overrides
});
