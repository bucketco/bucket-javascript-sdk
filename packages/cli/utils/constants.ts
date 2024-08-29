import path from "path";

export const API_BASE_URL =
  "http://localhost:3100/api" ?? "https://app.bucket.co/api";

export const CONFIG_FILE = path.join(
  process.env.HOME || "",
  ".bucket-cli-config.json",
);

export const GEN_TYPES_FILE = path.join(
  process.cwd(),
  "gen",
  "feature-flag-types.ts",
);
