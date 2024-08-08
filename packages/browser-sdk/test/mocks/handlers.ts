import { DefaultBodyType, http, HttpResponse, StrictRequest } from "msw";

import { Features, FeaturesResponse } from "../../src/feature/features";

export const testChannel = "testChannel";

export const featureResponse: FeaturesResponse = {
  success: true,
  features: {
    featureA: { value: true, key: "featureA", version: 1 },
  },
};

export const featuresResult: Features = {
  featureA: true,
};

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

  const url = new URL(request.url);
  if (!url.searchParams.get("context.user.id")) {
    console.error("no user id: " + url.searchParams.get("context.user.id"));
    return HttpResponse.json({ success: false });
  }
  return HttpResponse.json(featureResponse);
}

export const handlers = [
  http.post("https://front.bucket.co/user", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;

    const data = await request.json();
    if (!data || !data["userId"] || !data["attributes"]) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/company", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();
    if (!data || !data["companyId"] || !data["attributes"]) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/event", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();
    if (!data || !data["userId"]) {
      return new HttpResponse(null, { status: 400 });
    }

    return HttpResponse.json({
      success: true,
    });
  }),
  http.post("https://front.bucket.co/feedback", async ({ request }) => {
    if (!checkRequest(request)) return invalidReqResponse;
    const data = await request.json();
    if (!data || !data["userId"] || typeof data["score"] !== "number") {
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
  // http.post("https://ssehost.com/keys/keyName/requestToken", () => {
  //   return HttpResponse.json({
  //     token: "token",
  //     expires: new Date("2023-01-01T00:00:00.000Z"),
  //   });
  // }),
];
