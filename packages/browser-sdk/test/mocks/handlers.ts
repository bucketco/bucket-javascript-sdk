import { DefaultBodyType, http, HttpResponse, StrictRequest } from "msw";

import { RawFeatures } from "../../src/feature/features";

export const testChannel = "testChannel";

export const featureResponse = {
  success: true,
  features: {
    featureA: {
      isEnabled: true,
      key: "featureA",
      targetingVersion: 1,
      config: undefined,
    },
    featureB: {
      isEnabled: true,
      targetingVersion: 11,
      key: "featureB",
      config: {
        version: 12,
        key: "gpt3",
        payload: { model: "gpt-something", temperature: 0.5 },
      },
    },
  },
};

export const featuresResult = Object.entries(featureResponse.features).reduce(
  (acc, [key, feature]) => {
    acc[key] = {
      ...feature!,
      config: feature.config
        ? {
            key: feature.config.key,
            targetingVersion: feature.config.version,
            value: feature.config.payload,
          }
        : undefined,
      isEnabledOverride: null,
    };
    return acc;
  },
  {} as RawFeatures,
);

function checkRequest(request: StrictRequest<DefaultBodyType>) {
  const url = new URL(request.url);
  const hasKey =
    url.searchParams.get("publishableKey") ||
    request.headers.get("Authorization");

  const hasSdkVersion =
    url.searchParams.get("bucket-sdk-version") ||
    request.headers.get("bucket-sdk-version");

  const valid = hasKey && hasSdkVersion;
  if (!valid) {
    console.log(
      "missing token or sdk: " +
        request.url.toString() +
        " " +
        JSON.stringify(request.headers),
    );
  }
  return valid;
}

const invalidReqResponse = new HttpResponse("missing token or sdk", {
  status: 400,
});

export function getFeatures({
  request,
}: {
  request: StrictRequest<DefaultBodyType>;
}) {
  if (!checkRequest(request)) return invalidReqResponse;

  return HttpResponse.json(featureResponse);
}

export const handlers = [
  http.post("https://front.bucket.co/user", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;

    const data = await request.json();
    if (
      typeof data !== "object" ||
      !data ||
      !data["userId"] ||
      !data["attributes"]
    ) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/company", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();

    if (
      typeof data !== "object" ||
      !data ||
      !data["companyId"] ||
      !data["attributes"]
    ) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/event", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();

    if (typeof data !== "object" || !data || !data["userId"]) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/features/events", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();

    if (typeof data !== "object" || !data || !data["userId"]) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/feedback", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();
    if (
      typeof data !== "object" ||
      !data ||
      !data["userId"] ||
      typeof data["score"] !== "number" ||
      (!data["featureId"] && !data["featureKey"])
    ) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.get("https://front.bucket.co/features/enabled", getFeatures),
  http.post(
    "https://front.bucket.co/feedback/prompting-init",
    ({ request }) => {
      if (!checkRequest(request)) return invalidReqResponse;

      return HttpResponse.json({ success: true, channel: testChannel });
    },
  ),
  http.get("https://front.bucket.co/feedback/prompting-auth", ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    return HttpResponse.json({ success: true, keyName: "keyName" });
  }),
  http.post(
    "https://livemessaging.bucket.co/keys/keyName/requestToken",
    async ({ request }) => {
      const data = await request.json();
      if (typeof data !== "object") {
        return new HttpResponse(null, { status: 400 });
      }

      return HttpResponse.json({
        success: true,
        token: "token",
        expires: 1234567890,
      });
    },
  ),
];
