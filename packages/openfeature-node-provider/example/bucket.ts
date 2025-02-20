import { OpenFeature } from "@openfeature/server-sdk";
import { BucketNodeProvider } from "../src";

if (!process.env.BUCKET_SECRET_KEY) {
  throw new Error("BUCKET_SECRET_KEY is required");
}

export type CreateTodosConfig = {
  maxLength: number;
};

const provider = new BucketNodeProvider({
  secretKey: process.env.BUCKET_SECRET_KEY!,
  fallbackFeatures: {
    "show-todos": {
      isEnabled: true,
    },
    "create-todos": {
      isEnabled: true,
      config: {
        key: "default",
        payload: {
          maxLength: 100,
        },
      },
    },
  },
  logger: console,
});

OpenFeature.setProvider(provider);

export default provider;
