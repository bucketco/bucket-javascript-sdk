import { version } from "../package.json";

export const API_BASE_URL = "https://front.bucket.co";
export const APP_BASE_URL = "https://app.bucket.co";
export const SSE_REALTIME_BASE_URL = "https://livemessaging.bucket.co";

export const SDK_VERSION_HEADER_NAME = "reflag-sdk-version";

export const SDK_VERSION = `browser-sdk/${version}`;
export const FEATURE_EVENTS_PER_MIN = 1;
