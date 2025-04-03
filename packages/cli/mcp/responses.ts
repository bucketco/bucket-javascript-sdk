import { FlagVersion } from "../services/features.js";
import { JSONPrimitive } from "../utils/json.js";

export function textResponse(message: string, data?: JSONPrimitive) {
  let response = message.trim();
  if (data) {
    response += `"\n\n--- Raw JSON Response ---\n ${JSON.stringify(data, null, 2)}`;
  }
  return {
    content: [
      {
        type: "text" as const,
        text: response,
      },
    ],
  };
}

export function featuresResponse(data: JSONPrimitive) {
  return textResponse("List of features.", data);
}

export function feedbackResponse(data: JSONPrimitive) {
  return textResponse(
    "Feedback is returned in a JSON format with pages. Feedback score is between 1 and 5, with 0 being unknown.",
    data,
  );
}

export function featureCreateResponse(
  key: string,
  link: string,
  data: JSONPrimitive,
) {
  return textResponse(
    `
Feature created successfully. Show this link to the feature Bucket: ${link}. Now run the Bucket CLI in a terminal:
\`shell
$ npx bucket features types
\`
Make sure to feature flag the code with the new feature key: ${key}.
`,
    data,
  );
}

export function companiesResponse(data: JSONPrimitive) {
  return textResponse("List of companies.", data);
}

export function usersResponse(data: JSONPrimitive) {
  return textResponse("List of users.", data);
}

export function companyFeatureAccessResponse(
  isEnabled: boolean,
  featureKey: string,
  companyId: string,
) {
  return textResponse(
    `${isEnabled ? "Granted" : "Revoked"} access to feature '${featureKey}' for company ID '${companyId}'.`,
  );
}

export function updateFeatureStageResponse(featureKey: string) {
  return textResponse(`Updated flag targeting for feature '${featureKey}'.`);
}

export function updateFeatureAccessResponse(flagVersions: FlagVersion[]) {
  return textResponse(flagVersions.map((v) => v.changeDescription).join("\n"));
}
