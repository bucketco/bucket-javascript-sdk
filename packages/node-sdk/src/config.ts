import { version } from "../package.json";

export const API_HOST = "https://tracking.bucket.co";
export const SDK_VERSION_HEADER_NAME = "bucket-sdk-version";
export const SDK_VERSION = `node/${version}`;
export const API_TIMEOUT_MS = 5000;

export const BUCKET_LOG_PREFIX = "[Bucket]";

export const FLAG_EVENTS_PER_MIN = 1;
export const FLAGS_REFETCH_MS = 60 * 1000; // re-fetch every 60 seconds
