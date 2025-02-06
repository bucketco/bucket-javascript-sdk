import { defineFeatures } from "../../src";

export default defineFeatures([
  "huddles",
  "voiceMessages",
  {
    key: "optIn",
    config: { additionalCopy: "string" },
  },
] as const);
