import { beforeEach, describe, expect, it, vi } from "vitest";

import { BucketClient } from "../src/client";
import { FeaturesClient } from "../src/feature/features";
import { HttpClient } from "../src/httpClient";

import { featuresResult } from "./mocks/handlers";

describe("BucketClient", () => {
  let client: BucketClient;
  const httpClientPost = vi.spyOn(HttpClient.prototype as any, "post");

  const featureClientSetContext = vi.spyOn(
    FeaturesClient.prototype,
    "setContext",
  );

  beforeEach(() => {
    client = new BucketClient({
      publishableKey: "test-key",
      user: { id: "user1" },
      company: { id: "company1" },
    });
  });

  describe("updateUser", () => {
    it("should update the user context", async () => {
      // and send new user data and trigger feature update
      const updatedUser = { name: "New User" };

      await client.updateUser(updatedUser);

      expect(client["context"].user).toEqual({ id: "user1", ...updatedUser });
      expect(httpClientPost).toHaveBeenCalledWith({
        path: "/user",
        body: {
          userId: "user1",
          attributes: { name: updatedUser.name },
        },
      });
      expect(featureClientSetContext).toHaveBeenCalledWith(client["context"]);
    });
  });

  describe("updateCompany", () => {
    it("should update the company context", async () => {
      // send new company data and trigger feature update
      const updatedCompany = { name: "New Company" };

      await client.updateCompany(updatedCompany);

      expect(client["context"].company).toEqual({
        id: "company1",
        ...updatedCompany,
      });
      expect(httpClientPost).toHaveBeenCalledWith({
        path: "/company",
        body: {
          userId: "user1",
          companyId: "company1",
          attributes: { name: updatedCompany.name },
        },
      });
      expect(featureClientSetContext).toHaveBeenCalledWith(client["context"]);
    });
  });

  describe("getFeature", () => {
    it("takes overrides into account", async () => {
      await client.initialize();
      expect(featuresResult["featureA"].isEnabled).toBe(true);
      expect(client.getFeature("featureA").isEnabled).toBe(true);

      client.getFeature("featureA").setIsEnabledOverride(false);

      expect(client.getFeature("featureA").isEnabled).toBe(false);
    });
  });
});
