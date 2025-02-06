import { BucketClient, FeatureKey } from "../../src";
import features from "./bucket.config";

const urlParams = new URLSearchParams(window.location.search);
const publishableKey = urlParams.get("publishableKey");
const featureKey = (urlParams.get("featureKey") ?? "huddles") as FeatureKey<
  typeof features
>;

if (!publishableKey) {
  throw Error("publishableKey is missing");
}

const bucket = new BucketClient({
  publishableKey,
  user: { id: "42" },
  company: { id: "1" },
  toolbar: {
    show: true,
    position: { placement: "bottom-right" },
  },
  features,
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
  const { isEnabled, config } = bucket.getFeature("huddles");

  const startHuddleElem = document.getElementById("start-huddle");
  if (startHuddleElem) {
    startHuddleElem.innerText =
      config?.payload?.startHuddleCopy ?? "Start Huddle";
  }

  if (isEnabled) {
    // show the start-huddle button
    if (startHuddleElem) startHuddleElem.style.display = "block";
  } else {
    // hide the start-huddle button
    if (startHuddleElem) startHuddleElem.style.display = "none";
  }
});
