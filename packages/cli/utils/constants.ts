import path from "path";

const baseUrl = process.env.BUCKET_BASE_URL ?? "https://app.bucket.co";
export const loginUrl = (localPort: number) =>
  `${baseUrl}/login?redirect_url=` +
  encodeURIComponent("/cli-login?port=" + localPort);
export const API_BASE_URL = process.env.BUCKET_API_URL ?? `${baseUrl}/api`;

export const CONFIG_FILE = path.join(
  process.env.HOME || "",
  ".bucket-cli-config.json",
);

export const GEN_TYPES_FILE = path.join(
  process.cwd(),
  "gen",
  "feature-flag-types.ts",
);
