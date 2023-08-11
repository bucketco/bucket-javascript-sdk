import fetch from "cross-fetch";
import { isForNode } from "is-bundling-for-browser-or-node";
import { TRACKING_HOST } from "./config";
import {
  Company,
  Context,
  Feedback,
  FeedbackPromptCallback,
  Key,
  Options,
  TrackedEvent,
  User,
} from "./types";
import modulePackage from "../package.json";
import Ably from "ably/promises";
import { closeAblyConnection, openAblyConnection } from "./ably";

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
  let persistUser: boolean = !isForNode;
  let automaticFeedbackPrompting: boolean = false;
  let feedbackPromptCallback: FeedbackPromptCallback | undefined = undefined;
  let ablyClient: Ably.Realtime | undefined = undefined;
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
    reset();
    if (!key) {
      err("Tracking key was not provided");
    }
    trackingKey = key;
    if (options?.host) trackingHost = options.host;
    if (typeof options?.persistUser !== "undefined")
      persistUser = options.persistUser;
    if (options?.debug) debug = options.debug;
    if (options?.automaticFeedbackPrompting) {
      if (!persistUser) {
        err("Feedback prompting is not supported when persistUser is disabled");
      } else {
        automaticFeedbackPrompting = options.automaticFeedbackPrompting;
      }
    }
    if (options?.feedbackPromptCallback) {
      feedbackPromptCallback = options.feedbackPromptCallback;
    }
    log(`initialized with key "${trackingKey}" and options`, options);
  }

  async function user(
    userId: User["userId"],
    attributes?: User["attributes"],
    context?: Context
  ) {
    checkKey();
    if (!userId) err("No userId provided");
    if (persistUser) {
      if (sessionUserId && sessionUserId !== userId) {
        reset();
      }
      sessionUserId = userId;
      if (automaticFeedbackPrompting && !ablyClient) {
        await initFeedbackPrompting(userId, feedbackPromptCallback)
      }
    }
    const payload: User = {
      userId,
      attributes,
      context,
    };
    const res = await request(`${getUrl()}/user`, payload);
    log(`sent user`, res);
    return res;
  }

  async function company(
    companyId: Company["companyId"],
    attributes?: Company["attributes"] | null,
    userId?: Company["userId"],
    context?: Context
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
      context,
    };
    if (attributes) payload.attributes = attributes;
    const res = await request(`${getUrl()}/company`, payload);
    log(`sent company`, res);
    return res;
  }

  async function track(
    eventName: TrackedEvent["event"],
    attributes?: TrackedEvent["attributes"] | null,
    userId?: Company["userId"],
    companyId?: Company["companyId"],
    context?: Context
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
      companyId,
      context,
    };
    if (attributes) payload.attributes = attributes;
    const res = await request(`${getUrl()}/event`, payload);
    log(`sent event`, res);
    return res;
  }

  type FeedbackOptions = {
    featureId: string;
    // userId is optional. If not provided, it will be taken from session
    userId?: string;
    companyId?: string;
    score?: number;
    comment?: string;
  };

  async function feedback({
    featureId,
    score,
    userId,
    companyId,
    comment,
  }: FeedbackOptions) {
    checkKey();
    if (!featureId) err("No featureId provided");
    if (!score && !comment) err("Either 'score' or 'comment' must be provided");

    if (persistUser) {
      userId = getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }

    const payload: Feedback = {
      userId,
      featureId,
      score,
      companyId,
      comment,
    };

    const res = await request(`${getUrl()}/feedback`, payload);
    log(`sent feedback`, res);
    return res;
  }

  async function initFeedbackPrompting(
    userId?: User["userId"],
    requestCallback?: FeedbackPromptCallback,
  ) {
    checkKey();
    if (ablyClient) err("Feedback prompting already initialized. Use reset() first.");
    if (persistUser) {
      userId = getSessionUser();
    } else if (!userId) {
      err("No userId provided and persistUser is disabled");
    }
    const res = await request(`${getUrl()}/feedback/prompting-init`, {
      userId,
    });
    log(`feedback prompting status sent`, res);
    const body: { success: boolean, channel?: string } = await res.json()
    if (!body.success || !body.channel) {
      log(`feedback prompting not enabled`);
      return res;
    }

    log(`feedback prompting enabled`);
    const actualCallback = requestCallback || (() => {}); // dummy callback if not provided
    ablyClient = await openAblyConnection(`${getUrl()}/feedback/prompting-auth`, userId, body.channel, (data) => {
      if (typeof data?.question !== "string" ||
        typeof data?.showAfter !== "number" ||
        typeof data?.showBefore !== "number") {
        err(`invalid feedback prompt message received`, data);
      } else {
        log(`feedback prompt received`, data);
        actualCallback({
          question: data.question,
          showAfter: new Date(data.showAfter),
          showBefore: new Date(data.showBefore),
        });
      }
    }, debug)

    log(`feedback prompting connection established`);
    return res;
  }

  function reset() {
    sessionUserId = undefined;
    if (ablyClient) {
      closeAblyConnection(ablyClient);
      log(`feedback prompting connection closed`);

      ablyClient = undefined;
    }
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
    // feedback prompting
    initFeedbackPrompting,
  };
}
