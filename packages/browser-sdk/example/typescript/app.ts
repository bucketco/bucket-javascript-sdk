import { BucketClient } from "../../";

const urlParams = new URLSearchParams(window.location.search);
const publishableKey = urlParams.get("publishableKey");
const featureKey = urlParams.get("featureKey") ?? "huddles";

const features = {
  huddles: true,
};

const bucket = new BucketClient({
  publishableKey,
  user: { id: "42" },
  company: { id: "1" },
  toolbar: {
    show: true,
    position: "bottom-right",
  },
  featureDefinitions: features,
});

document.getElementById("startHuddle").onclick = () => bucket.track(featureKey);
document.getElementById("giveFeedback").onclick = (event) =>
  bucket.requestFeedback({
    featureKey,
    position: { type: "POPOVER", anchor: event.currentTarget as HTMLElement },
  });

bucket.initialize().then(() => {
  console.log("Bucket initialized");
  document.getElementById("loading").style.display = "none";
});

bucket.addEventListener("featuresChanged", () => {
  const { isEnabled } = bucket.getFeature("huddles");
  if (isEnabled) {
    // show the start-huddle button
    document.getElementById("start-huddle").style.display = "block";
  } else {
    // hide the start-huddle button
    document.getElementById("start-huddle").style.display = "none";
  }
});
