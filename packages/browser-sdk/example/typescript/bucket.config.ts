import { defineFeatures } from "../../src";

export default defineFeatures([
  "feature1",
  "feature2",
  { key: "huddles", config: { startHuddleCopy: "string" } },
]);
