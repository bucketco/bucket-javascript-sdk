import { FeaturesType } from "../../src";
import features from "./bucket.features";

declare module "../../src" {
  interface Features extends FeaturesType<typeof features> {}
}
