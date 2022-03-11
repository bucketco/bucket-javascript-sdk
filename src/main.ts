import fetch from "cross-fetch";
import { TRACKING_HOST } from "./config";
import { Company, Key, Options, TrackedEvent, User } from "./types";
import modulePackage from "../package.json";

async function request(url: string, body: any) {
  return fetch(url, {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      "Bucket-Sdk-Version": modulePackage.version,
    },
    body: JSON.stringify(body),
  });
}

export default function main() {
  let trackingKey: string | undefined = undefined;
  let trackingHost: string = TRACKING_HOST;
  let sessionUserId: string | undefined = undefined;
  let debug = false;

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
    if (!sessionUserId) {
      err(
        "User is not set, please call user() first or provide userId as argument"
      );
    }
  }
  function log(...args: any[]) {
    if (debug) {
      console.log("[Bucket]", ...args);
    }
  }
  function err(...args: any[]) {
    if (debug) {
      console.error("[Bucket]", ...args);
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
    sessionUserId = id;
    const payload: User = {
      userId: sessionUserId,
      attributes,
    };
    const res = await request(`${getUrl()}/user`, payload);
    log(`sent user`, res);
    return res;
  }

  async function company(
    companyId: Company["companyId"],
    attributes?: Company["attributes"],
    userId?: Company["userId"]
  ) {
    checkKey();
    if (!companyId) err("No companyId provided");
    if (!userId) {
      checkUser();
      userId = sessionUserId!;
    }
    const payload: Company = {
      userId,
      companyId,
      attributes,
    };
    const res = await request(`${getUrl()}/company`, payload);
    log(`sent company`, res);
    return res;
  }

  async function track(
    eventName: TrackedEvent["event"],
    attributes?: TrackedEvent["attributes"],
    userId?: Company["userId"]
  ) {
    checkKey();
    if (!eventName) err("No eventName provided");
    if (!userId) {
      checkUser();
      userId = sessionUserId!;
    }
    const payload: TrackedEvent = {
      userId,
      event: eventName,
      attributes,
    };
    const res = await request(`${getUrl()}/event`, payload);
    log(`sent event`, res);
    return res;
  }

  function reset() {
    sessionUserId = undefined;
  }

  return {
    // lifecycle
    init,
    reset,
    // requests
    user,
    company,
    track,
  };
}
