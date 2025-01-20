import { BucketClient } from "../../";

const urlParams = new URLSearchParams(window.location.search);
const publishableKey = urlParams.get("publishableKey") ?? "publishableKey";
const featureKey = urlParams.get("featureKey") ?? "huddles";

const featureList = ["huddles"];

const bucket = new BucketClient({
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
