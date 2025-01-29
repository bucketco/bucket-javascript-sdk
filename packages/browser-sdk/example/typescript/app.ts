import { BucketClient } from "../../src";

const urlParams = new URLSearchParams(window.location.search);
const publishableKey = urlParams.get("publishableKey");
const featureKey = (urlParams.get("featureKey") ??
  "huddles") as keyof FeatureTypes;

if (!publishableKey) {
  throw Error("publishableKey is missing");
}

interface FeatureTypes {
  huddles: {
    key: "huddles";
    isEnabled: boolean;
    config: {
      title: string;
      description: string;
    };
  };
  voiceHuddle: {
    key: "voiceHuddle";
    isEnabled: boolean;
    config: {
      volumeMax: number;
    };
  };
}

const featureList = ["huddles", "voiceHuddle"];

const bucket = new BucketClient<FeatureTypes>({
  publishableKey,
  user: { id: "42" },
  company: { id: "1" },
  toolbar: {
    show: true,
    position: { placement: "bottom-right" },
  },
  featureList,
});

document
  .getElementById("startHuddle")
  ?.addEventListener("click", () => bucket.track(featureKey));
document.getElementById("giveFeedback")?.addEventListener("click", (event) =>
  bucket.requestFeedback({
    featureKey,
    position: { type: "POPOVER", anchor: event.currentTarget as HTMLElement },
  }),
);

bucket.initialize().then(() => {
  console.log("Bucket initialized");
  const loadingElem = document.getElementById("loading");
  if (loadingElem) loadingElem.style.display = "none";
});

bucket.onFeaturesUpdated(() => {
  const { isEnabled } = bucket.getFeature("huddles");

  const startHuddleElem = document.getElementById("start-huddle");
  if (isEnabled) {
    // show the start-huddle button
    if (startHuddleElem) startHuddleElem.style.display = "block";
  } else {
    // hide the start-huddle button
    if (startHuddleElem) startHuddleElem.style.display = "none";
  }
});
