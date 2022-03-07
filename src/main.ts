import fetch from "cross-fetch";
import { TRACKING_HOST } from "./config";
import { Company, Key, Options, TrackedEvent, User } from "./types";

export default function instance(key: Key, options?: Options) {
  let trackingKey: string | null = null;
  let trackingHost: string = TRACKING_HOST;
  let userId: string | null = null;

  // init

  if (!key) {
    throw new Error("Tracking key was not provided");
  }
  trackingKey = key;

  if (options?.host) {
    trackingHost = options.host;
  }

  // utils

  function getUrl() {
    return `${trackingHost}/${trackingKey}`;
  }
  function checkUser() {
    if (!userId) {
      throw new Error("User is not set, please call user() first");
    }
  }

  // methods

  function user(id: User["userId"], attributes: User["attributes"] = {}) {
    if (!id) {
      throw new Error("No userId provided");
    }
    userId = id;

    return fetch(`${getUrl()}/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId,
        attributes,
      }),
    });
  }

  function company(
    companyId: Company["companyId"],
    attributes: Company["attributes"] = {}
  ) {
    checkUser();
    if (!companyId) {
      throw new Error("No companyId provided");
    }
    const payload: Company = {
      userId: userId!,
      companyId,
      attributes,
    };
    return fetch(`${getUrl()}/company`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  function event(
    eventName: TrackedEvent["event"],
    attributes: TrackedEvent["attributes"] = {}
  ) {
    checkUser();
    if (!eventName) {
      throw new Error("No eventName provided");
    }
    const payload: TrackedEvent = {
      userId: userId!,
      event: eventName,
      attributes,
    };
    return fetch(`${getUrl()}/event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  }

  function reset() {
    userId = null;
  }

  return {
    user,
    company,
    event,
    reset,
    // method aliases
    identify: user,
    group: company,
    track: event,
    // variables
    trackingKey,
    trackingHost,
  };
}
