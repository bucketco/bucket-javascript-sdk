import { version } from "../package.json";

export const API_HOST = "https://front.bucket.co";
export const SSE_REALTIME_HOST = "https://livemessaging.bucket.co";

export const SDK_VERSION_HEADER_NAME = "bucket-sdk-version";

export const SDK_VERSION = `browser-sdk/${version}`;
export const FLAG_EVENTS_PER_MIN = 1;
