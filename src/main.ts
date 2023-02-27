import fetch from "cross-fetch";
import { isForNode } from "is-bundling-for-browser-or-node";
import { TRACKING_HOST } from "./config";
import { Company, Feedback, Key, Options, TrackedEvent, User } from "./types";
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
  let persistUser: boolean = isForNode ? false : true;
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
  function getSessionUser() {
    if (!sessionUserId) {
      err(
        "User is not set, please call user() first or provide userId as argument"
      );
    }
    return sessionUserId;
  }
  function log(...args: any[]) {
    if (debug) {
      console.log("[Bucket]", ...args);
    }
  }
  function err(...args: any[]): never {
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
    if (typeof options?.persistUser !== "undefined")
      persistUser = options?.persistUser;
    if (options?.debug) debug = options?.debug;
    log(`initialized with key "${trackingKey}" and options`, options);
  }

  async function user(userId: User["userId"], attributes?: User["attributes"]) {
    checkKey();
    if (!userId) err("No userId provided");
    if (persistUser) sessionUserId = userId;
    const payload: User = {
      userId,
      attributes,
    };
    const res = await request(`${getUrl()}/user`, payload);
    log(`sent user`, res);
    return res;
  }

  async function company(
    companyId: Company["companyId"],
    attributes?: Company["attributes"] | null,
    userId?: Company["userId"]
  ) {
    checkKey();
    if (!companyId) err("No companyId provided");
    if (persistUser) {
      userId = getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }
    const payload: Company = {
      userId,
      companyId,
    };
    if (attributes) payload.attributes = attributes;
    const res = await request(`${getUrl()}/company`, payload);
    log(`sent company`, res);
    return res;
  }

  async function track(
    eventName: TrackedEvent["event"],
    attributes?: TrackedEvent["attributes"] | null,
    userId?: Company["userId"]
  ) {
    checkKey();
    if (!eventName) err("No eventName provided");
    if (persistUser) {
      userId = getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }
    const payload: TrackedEvent = {
      userId,
      event: eventName,
    };
    if (attributes) payload.attributes = attributes;
    const res = await request(`${getUrl()}/event`, payload);
    log(`sent event`, res);
    return res;
  }

  // userId is optional. If not provided, it will be taken from session
  type FeedbackOptions = Omit<Feedback, "userId"> & {
    userId?: Feedback["userId"];
  };

  async function feedback({
    featureId,
    sentiment,
    effort_score,
    userId,
    companyId,
    comment,
  }: FeedbackOptions) {
    checkKey();
    if (!featureId) err("No featureId provided");

    if (persistUser) {
      userId = getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }

    const payload: Feedback = {
      userId,
      featureId,
      sentiment,
      effort_score,
      companyId,
      comment,
    };

    const res = await request(`${getUrl()}/feedback`, payload);
    log(`sent feedback`, res);
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
    feedback,
  };
}
