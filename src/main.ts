import fetch from "cross-fetch";
import { TRACKING_HOST } from "./config";
import { Company, Key, Options, TrackedEvent, User } from "./types";

export default function main() {
  let trackingKey: string | null = null;
  let trackingHost: string = TRACKING_HOST;
  let debug = false;
  let userId: string | null = null;

  log("Instance created");

  function getUrl() {
    return `${trackingHost}/${trackingKey}`;
  }
  function checkKey() {
    if (!trackingKey) {
      err("Tracking key is not set, please call init() first");
    }
  }
  function checkUser() {
    if (!userId) {
      err("User is not set, please call user() first");
    }
  }
  function log(...args: any[]) {
    if (debug) {
      console.log("[BucketTracking]", ...args);
    }
  }
  function err(...args: any[]) {
    if (debug) {
      console.error("[BucketTracking]", ...args);
    }
    throw new Error(...args);
  }

  // methods

  function init(key: Key, options?: Options) {
    if (!key) {
      err("Tracking key was not provided");
    }
    trackingKey = key;
    if (options?.host) trackingHost = options?.host;
    if (options?.debug) debug = options?.debug;
    log(`initialied with key "${trackingKey}" and options`, options);
  }

  async function user(id: User["userId"], attributes?: User["attributes"]) {
    checkKey();
    if (!id) err("No userId provided");
    userId = id;
    const payload: User = {
      userId,
      attributes,
    };
    const res = await fetch(`${getUrl()}/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    log(`sent user`, res);
    return res;
  }

  async function company(
    companyId: Company["companyId"],
    attributes?: Company["attributes"]
  ) {
    checkKey();
    checkUser();
    if (!companyId) err("No companyId provided");
    const payload: Company = {
      userId: userId!,
      companyId,
      attributes,
    };
    const res = await fetch(`${getUrl()}/company`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    log(`sent company`, res);
    return res;
  }

  async function event(
    eventName: TrackedEvent["event"],
    attributes?: TrackedEvent["attributes"]
  ) {
    checkKey();
    checkUser();
    if (!eventName) err("No eventName provided");
    const payload: TrackedEvent = {
      userId: userId!,
      event: eventName,
      attributes,
    };
    const res = await fetch(`${getUrl()}/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    log(`sent event`, res);
    return res;
  }

  function reset() {
    userId = null;
  }

  return {
    // lifecycle
    init,
    reset,
    // requests
    user,
    company,
    event,
    // method aliases
    identify: user,
    group: company,
    track: event,
  };
}
