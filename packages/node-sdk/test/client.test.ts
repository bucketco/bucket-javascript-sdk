import flushPromises from "flush-promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateFlag } from "@bucketco/flag-evaluation";

import { BucketClient } from "../src/client";
import {
  API_HOST,
  FLAGS_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "../src/config";
import fetchClient from "../src/fetch-http-client";
import { ClientOptions, FlagDefinitions, Flags } from "../src/types";

vi.mock("@bucketco/flag-evaluation", () => ({
  evaluateFlag: vi.fn(),
}));

describe("Client", () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const httpClient = { post: vi.fn(), get: vi.fn() };

  const validOptions: ClientOptions = {
    secretKey: "validSecretKeyWithMoreThan22Chars",
    host: "https://api.example.com",
    logger,
    httpClient,
    refetchInterval: 61000,
    staleWarningInterval: 310000,
  };

  const user = {
    userId: "user123",
    attrs: { age: 1, name: "John" },
  };

  const company = {
    companyId: "company123",
    attrs: { employees: 100, name: "Acme Inc." },
  };

  const event = {
    event: "testEvent",
    attrs: { key: "value" },
  };

  const customContext = { custom: "context", key: "value" };

  const expectedGetHeaders = {
    [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
    "Content-Type": "application/json",
  };

  const expectedPostHeaders = {
    ...expectedGetHeaders,
    Authorization: `Bearer ${validOptions.secretKey}`,
  };

  describe("constructor (with options)", () => {
    it("should create a client instance with valid options", () => {
      const client = new BucketClient(validOptions);

      expect(client).toBeInstanceOf(BucketClient);
      expect(client["_shared"].host).toBe("https://api.example.com");
      expect(client["_shared"].refetchInterval).toBe(61000);
      expect(client["_shared"].staleWarningInterval).toBe(310000);
      expect(client["_shared"].logger).toBeDefined();
      expect(client["_shared"].httpClient).toBe(validOptions.httpClient);
      expect(client["_shared"].secretKey).toBe(validOptions.secretKey);
      expect(client["_shared"].headers).toEqual(expectedGetHeaders);
    });

    it("should route messages to the supplied logger", () => {
      const client = new BucketClient(validOptions);

      const actualLogger = client["_shared"].logger!;
      actualLogger.debug("debug message");
      actualLogger.info("info message");
      actualLogger.warn("warn message");
      actualLogger.error("error message");

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching("debug message"),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching("info message"),
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching("warn message"),
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching("error message"),
      );
    });

    it("should create a client instance with default values for optional fields", () => {
      const client = new BucketClient({
        secretKey: "validSecretKeyWithMoreThan22Chars",
      });

      expect(client).toBeInstanceOf(BucketClient);
      expect(client["_shared"].host).toBe(API_HOST);
      expect(client["_shared"].secretKey).toBe(validOptions.secretKey);
      expect(client["_shared"].refetchInterval).toBe(FLAGS_REFETCH_MS);
      expect(client["_shared"].staleWarningInterval).toBe(FLAGS_REFETCH_MS * 5);
      expect(client["_shared"].logger).toBeUndefined();
      expect(client["_shared"].httpClient).toBe(fetchClient);
      expect(client["_shared"].headers).toEqual(expectedGetHeaders);
    });

    it("should throw an error if options are invalid", () => {
      let invalidOptions: any = null;
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "options must be an object",
      );

      invalidOptions = { ...validOptions, secretKey: "shortKey" };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "secretKey must be a string",
      );

      invalidOptions = { ...validOptions, host: 123 };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "host must be a string",
      );

      invalidOptions = {
        ...validOptions,
        logger: "invalidLogger" as any,
      };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "logger must be an object",
      );

      invalidOptions = {
        ...validOptions,
        httpClient: "invalidHttpClient" as any,
      };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "httpClient must be an object",
      );

      invalidOptions = {
        ...validOptions,
        refetchInterval: "notANumber" as any,
      };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "refetchInterval must be a number",
      );

      invalidOptions = {
        ...validOptions,
        staleWarningInterval: "notANumber" as any,
      };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "staleWarningInterval must be a number",
      );
    });
  });

  describe("constructor (with existing client)", () => {
    const initialClient = new BucketClient(validOptions);

    initialClient["_customContext"] = { key: "value" };
    initialClient["_company"] = {
      companyId: "123",
      attrs: {},
    };
    initialClient["_user"] = { userId: "abc", attrs: {} };
    initialClient["_fallbackFlags"] = {
      flagKey: { key: "flagKey", value: true, version: 1 },
    };

    it("should create a new client instance based on an existing client", () => {
      const newClient = new BucketClient(initialClient);

      expect(newClient).toBeInstanceOf(BucketClient);
      expect(newClient["_shared"]).toBe(initialClient["_shared"]);
      expect(newClient["_context"]).toEqual(initialClient["_context"]);
      expect(newClient["_company"]).toEqual(initialClient["_company"]);
      expect(newClient["_user"]).toEqual(initialClient["_user"]);
      expect(newClient["_fallbackFlags"]).toEqual(
        initialClient["_fallbackFlags"],
      );
    });

    it("should create a new client instance and allow modifying context independently", () => {
      const newClient = new BucketClient(initialClient);
      newClient["_customContext"] = { key: "newValue" };

      expect(newClient["_customContext"]).not.toEqual(
        initialClient["_customContext"],
      );
      expect(initialClient["_customContext"]).toEqual({ key: "value" });
    });

    it("should create a new client instance and allow modifying company independently", () => {
      const newClient = new BucketClient(initialClient);
      newClient["_company"] = { companyId: "456", attrs: {} };

      expect(newClient["_company"]).not.toEqual(initialClient["_company"]);
      expect(initialClient["_company"]).toEqual({
        companyId: "123",
        attrs: {},
      });
    });

    it("should create a new client instance and allow modifying user independently", () => {
      const newClient = new BucketClient(initialClient);
      newClient["_user"] = { userId: "def", attrs: {} };

      expect(newClient["_user"]).not.toEqual(initialClient["_user"]);
      expect(initialClient["_user"]).toEqual({
        userId: "abc",
        attrs: {},
      });
    });

    it("should create a new client instance and allow modifying fallbackFlags independently", () => {
      const newClient = new BucketClient(initialClient);
      newClient["_fallbackFlags"] = {
        flagKey: { key: "flagKey", value: false, version: 2 },
      };

      expect(newClient["_fallbackFlags"]).not.toEqual(
        initialClient["_fallbackFlags"],
      );
      expect(initialClient["_fallbackFlags"]).toEqual({
        flagKey: { key: "flagKey", value: true, version: 1 },
      });
    });
  });

  describe("withUser", () => {
    const client = new BucketClient(validOptions);

    it("should return a new client instance with the user set", () => {
      const newClient = client.withUser(user.userId, {
        attributes: user.attrs,
      });

      expect(newClient).toBeInstanceOf(BucketClient);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["_user"]).toEqual(user);
    });

    it("should return a new client instance with merged user attributes", () => {
      const override = { sex: "male", age: 30 };
      const newClient = client
        .withUser(user.userId, { attributes: user.attrs })
        .withUser(user.userId, { attributes: override });

      expect(newClient["_user"]).toEqual({
        userId: user.userId,
        attrs: { ...user.attrs, ...override },
      });
    });

    it("should return a new client instance with reset user", () => {
      const newClient = client
        .withUser(user.userId, { attributes: user.attrs })
        .withUser("anotherUser", { attributes: { another: "value" } });

      expect(newClient["_user"]).toEqual({
        userId: "anotherUser",
        attrs: { another: "value" },
      });
    });

    it("should throw an error if user is invalid", () => {
      expect(() => client.withUser(undefined as any)).toThrow(
        "userId must be a string",
      );

      expect(() => client.withUser(1 as any)).toThrow(
        "userId must be a string",
      );

      expect(() => client.withUser(user.userId, "bad_opts" as any)).toThrow(
        "opts must be an object",
      );

      expect(() =>
        client.withUser(user.userId, { attributes: "bad_attributes" as any }),
      ).toThrow("attributes must be an object");
    });
  });

  describe("withCompany", () => {
    const client = new BucketClient(validOptions);

    it("should return a new client instance with the company set", () => {
      const newClient = client.withCompany(company.companyId, {
        attributes: company.attrs,
      });

      expect(newClient).toBeInstanceOf(BucketClient);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["company"]).toEqual(company);
    });

    it("should return a new client instance with merged company attributes", () => {
      const override = { age: 30, name: "not acme" };
      const newClient = client
        .withCompany(company.companyId, { attributes: company.attrs })
        .withCompany(company.companyId, { attributes: override });

      expect(newClient["_company"]).toEqual({
        companyId: company.companyId,
        attrs: { ...company.attrs, ...override },
      });
    });

    it("should return a new client instance with reset company", () => {
      const newClient = client
        .withCompany(company.companyId, { attributes: company.attrs })
        .withCompany("anotherCompany", { attributes: { another: "value" } });

      expect(newClient["_company"]).toEqual({
        companyId: "anotherCompany",
        attrs: { another: "value" },
      });
    });

    it("should throw an error if company is invalid", () => {
      expect(() => client.withCompany(undefined as any)).toThrow(
        "companyId must be a string",
      );

      expect(() => client.withCompany(1 as any)).toThrow(
        "companyId must be a string",
      );

      expect(() =>
        client.withCompany(company.companyId, "bad_opts" as any),
      ).toThrow("opts must be an object");

      expect(() =>
        client.withCompany(company.companyId, {
          attributes: "bad_attributes" as any,
        }),
      ).toThrow("attributes must be an object");
    });
  });

  describe("withCustomContext", () => {
    const client = new BucketClient(validOptions);

    it("should return a new client instance with the custom context set", () => {
      const newClient = client.withCustomContext(customContext);

      expect(newClient).toBeInstanceOf(BucketClient);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["_customContext"]).toEqual(customContext);
    });

    it("should return a new client instance with replaced custom context", () => {
      const newClient = client
        .withCustomContext(customContext)
        .withCustomContext({ replaced: true }, { replace: true });

      expect(newClient["_customContext"]).toEqual({ replaced: true });
    });

    it("should return a new client instance with merged custom context", () => {
      const override = { merged: true, key: "not value" };
      const newClient = client
        .withCustomContext(customContext)
        .withCustomContext(override);

      expect(newClient["_customContext"]).toEqual({
        ...customContext,
        ...override,
      });
    });

    it("should throw an error if custom context is not an object", () => {
      expect(() => client.withCustomContext(null as any)).toThrow(
        "context must be an object",
      );
      expect(() => client.withCustomContext(123 as any)).toThrow(
        "context must be an object",
      );
      expect(() => client.withCustomContext("invalidContext" as any)).toThrow(
        "context must be an object",
      );
      expect(() => client.withCustomContext([] as any)).toThrow(
        "context must be an object",
      );
    });
  });

  describe("trackUser", () => {
    const client = new BucketClient(validOptions);

    it("should successfully update the user when user is defined", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const result = await client.trackUser(user.userId, {
        attributes: user.attrs,
        meta: {
          active: true,
        },
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/user",
        expectedPostHeaders,
        {
          userId: user.userId,
          attributes: user.attrs,
          context: { active: true },
        },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "user"'),
        true,
      );
    });

    it("should return false and log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const result = await client.trackUser(user.userId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "user" failed with error'),
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      httpClient.post.mockResolvedValue({ success: false });

      const result = await client.trackUser(user.userId);

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "user"'),
        false,
      );
    });

    it("should throw an error if user is not valid", async () => {
      await expect(client.trackUser(undefined as any)).rejects.toThrow(
        "userId must be a string",
      );

      await expect(client.trackUser(1 as any)).rejects.toThrow(
        "userId must be a string",
      );

      await expect(
        client.trackUser(user.userId, "bad_opts" as any),
      ).rejects.toThrow("opts must be an object");

      await expect(
        client.trackUser(user.userId, { attributes: "bad_attributes" as any }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.trackUser(user.userId, { meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("trackCompany", () => {
    const client = new BucketClient(validOptions);

    it("should successfully update the company when company is defined", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const result = await client.trackCompany(company.companyId, {
        attributes: company.attrs,
        meta: { active: true },
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        expectedPostHeaders,
        {
          companyId: company.companyId,
          attributes: company.attrs,
          context: { active: true },
        },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company"'),
        true,
      );
    });

    it("should include the user ID as well, if user was defined", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const result = await client.trackCompany(company.companyId, {
        userId: user.userId,
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        expectedPostHeaders,
        { companyId: company.companyId, userId: user.userId },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company"'),
        true,
      );
    });

    it("should return false and log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const result = await client.trackCompany(company.companyId);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company" failed with error'),
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      httpClient.post.mockResolvedValue({ success: false });

      const result = await client.trackCompany(company.companyId);

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company"'),
        false,
      );
    });

    it("should throw an error if company is not valid", async () => {
      await expect(client.trackCompany(undefined as any)).rejects.toThrow(
        "companyId must be a string",
      );

      await expect(client.trackCompany(1 as any)).rejects.toThrow(
        "companyId must be a string",
      );

      await expect(
        client.trackCompany(company.companyId, "bad_opts" as any),
      ).rejects.toThrow("opts must be an object");

      await expect(
        client.trackCompany(company.companyId, { userId: 1 as any }),
      ).rejects.toThrow("userId must be a string");

      await expect(
        client.trackCompany(company.companyId, {
          attributes: "bad_attributes" as any,
        }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.trackCompany(company.companyId, {
          meta: "bad_meta" as any,
        }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("trackFeatureUsage", () => {
    const client = new BucketClient(validOptions);

    it("should successfully track the feature usage", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const result = await client.trackFeatureUsage(event.event, {
        attributes: event.attrs,
        meta: { active: true },
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        expectedPostHeaders,
        {
          event: event.event,
          attributes: event.attrs,
          context: { active: true },
        },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "event"'),
        true,
      );
    });

    it("should successfully track the feature usage including user and company", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const result = await client.trackFeatureUsage(event.event, {
        companyId: company.companyId,
        userId: user.userId,
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        expectedPostHeaders,
        {
          event: event.event,
          companyId: company.companyId,
          userId: user.userId,
        },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "event"'),
        true,
      );
    });

    it("should return false and log an error if the post request fails", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const result = await client.trackFeatureUsage(event.event);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "event" failed with error'),
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      httpClient.post.mockResolvedValue({ success: false });

      const result = await client.trackFeatureUsage(event.event);

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "event"'),
        false,
      );
    });

    it("should throw an error if event is invalid", async () => {
      await expect(client.trackFeatureUsage(undefined as any)).rejects.toThrow(
        "event must be a string",
      );
      await expect(client.trackFeatureUsage(1 as any)).rejects.toThrow(
        "event must be a string",
      );

      await expect(
        client.trackFeatureUsage(event.event, "bad_opts" as any),
      ).rejects.toThrow("opts must be an object");

      await expect(
        client.trackFeatureUsage(event.event, { companyId: 1 as any }),
      ).rejects.toThrow("companyId must be a string");

      await expect(
        client.trackFeatureUsage(event.event, { userId: 1 as any }),
      ).rejects.toThrow("userId must be a string");

      await expect(
        client.trackFeatureUsage(event.event, {
          attributes: "bad_attributes" as any,
        }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.trackFeatureUsage(event.event, { meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("user", () => {
    it("should return the undefined if user was not set", () => {
      const client = new BucketClient(validOptions);
      expect(client.user).toBeUndefined();
    });

    it("should return the user if user was associated", () => {
      const client = new BucketClient(validOptions).withUser(user.userId, {
        attributes: user.attrs,
      });

      expect(client.user).toEqual(user);
    });
  });

  describe("company", () => {
    it("should return the undefined if company was not set", () => {
      const client = new BucketClient(validOptions);
      expect(client.company).toBeUndefined();
    });

    it("should return the user if company was associated", () => {
      const client = new BucketClient(validOptions).withCompany(
        company.companyId,
        { attributes: company.attrs },
      );

      expect(client.company).toEqual(company);
    });
  });

  describe("customContext", () => {
    it("should return the undefined if custom context was not set", () => {
      const client = new BucketClient(validOptions);
      expect(client.customContext).toBeUndefined();
    });

    it("should return the user if custom context was associated", () => {
      const client = new BucketClient(validOptions).withCustomContext(
        customContext,
      );

      expect(client.customContext).toEqual(customContext);
    });
  });

  describe("initialize", () => {
    it("should initialize the client and set fallbackFlags", async () => {
      const client = new BucketClient(validOptions);
      const fallbackFlags: Flags = {
        flagKey: { key: "flagKey", value: true, version: 1 },
      };

      const cache = {
        refresh: vi.fn(),
        get: vi.fn(),
      };

      vi.spyOn(client as any, "getFeatureFlagDefinitionCache").mockReturnValue(
        cache,
      );

      await client.initialize(fallbackFlags);

      expect(client["_fallbackFlags"]).toEqual(fallbackFlags);
      expect(cache.refresh).toHaveBeenCalledTimes(1);
      expect(cache.get).not.toHaveBeenCalled();
    });

    it("should initialize the client without fallbackFlags", async () => {
      const client = new BucketClient(validOptions);

      const cache = {
        refresh: vi.fn(),
        get: vi.fn(),
      };

      vi.spyOn(client as any, "getFeatureFlagDefinitionCache").mockReturnValue(
        cache,
      );

      await client.initialize();

      expect(client["_fallbackFlags"]).toBeUndefined();
      expect(cache.refresh).toHaveBeenCalledTimes(1);
      expect(cache.get).not.toHaveBeenCalled();
    });

    it("should set up the cache object", async () => {
      const client = new BucketClient(validOptions);
      expect(client["_shared"].featureFlagDefinitionCache).toBeUndefined();

      await client.initialize();
      expect(client["_shared"].featureFlagDefinitionCache).toBeTypeOf("object");
    });

    it("should throw an error if fallbackFlags is not an object", async () => {
      const client = new BucketClient(validOptions);

      await expect(client.initialize("invalidFlags" as any)).rejects.toThrow(
        "fallbackFlags must be an object",
      );
    });

    it("should call the backend to obtain flags", async () => {
      const client = new BucketClient(validOptions);
      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledWith(
        `https://api.example.com/flags&key=${validOptions.secretKey}`,
        expectedGetHeaders,
      );
    });
  });

  describe("getFlags", () => {
    let client: BucketClient;

    const fallbackFlags: Flags = {
      flagKey: { key: "flagKey", value: true },
    };

    const flagDefinitions: FlagDefinitions = {
      flags: [
        {
          key: "flag1",
          version: 1,
          rules: [
            {
              filter: [
                {
                  field: "attributeKey",
                  operator: "IS",
                  values: ["attributeValue"],
                },
              ],
            },
          ],
        },
        {
          key: "flag2",
          version: 2,
          rules: [
            {
              partialRolloutThreshold: 0.5,
              partialRolloutAttribute: "attributeKey",
              filter: [
                {
                  field: "attributeKey",
                  operator: "IS",
                  values: ["attributeValue"],
                },
              ],
            },
          ],
        },
      ],
    };

    const evaluatedFlags = [
      {
        flag: { key: "flag1", version: 1 },
        value: true,
        context: {},
        ruleEvaluationResults: [true],
        missingContextFields: [],
      },
      {
        flag: { key: "flag2", version: 2 },
        value: false,
        context: {},
        ruleEvaluationResults: [false],
        missingContextFields: ["something"],
      },
    ];

    beforeEach(async () => {
      vi.clearAllMocks();

      httpClient.get.mockResolvedValue({
        success: true,
        ...flagDefinitions,
      });

      client = new BucketClient(validOptions);

      vi.mocked(evaluateFlag).mockImplementation(({ flag, context }) => {
        const evalFlag = evaluatedFlags.find((f) => f.flag.key === flag.key)!;
        const flagDef = flagDefinitions.flags.find((f) => f.key === flag.key)!;

        return {
          value: evalFlag.value,
          flag: flagDef,
          context: context,
          ruleEvaluationResults: evalFlag.ruleEvaluationResults,
          missingContextFields: evalFlag.missingContextFields,
        };
      });

      httpClient.post.mockResolvedValue({ success: true });
    });

    it("should return evaluated flags when user, company, and custom context are defined", async () => {
      client = client
        .withUser(user.userId, { attributes: user.attrs })
        .withCompany(company.companyId, { attributes: company.attrs })
        .withCustomContext(customContext);

      await client.initialize();
      const result = client.getFlags();

      expect(result).toEqual({
        flag1: { key: "flag1", value: true, version: 1 },
      });

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(3); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            company: {
              id: "company123",
              ...company.attrs,
            },
            user: {
              id: "user123",
              ...user.attrs,
            },
            ...customContext,
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            company: {
              id: "company123",
              ...company.attrs,
            },
            user: {
              id: "user123",
              ...user.attrs,
            },
            ...customContext,
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        3,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "check",
          flagKey: "flag1",
          flagVersion: 1,
          evalResult: true,
        },
      );
    });

    it("should return evaluated flags when only user is defined", async () => {
      client = client.withUser(user.userId, { attributes: user.attrs });

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            user: {
              id: "user123",
              ...user.attrs,
            },
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            user: {
              id: "user123",
              ...user.attrs,
            },
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );
    });

    it("should return evaluated flags when only company is defined", async () => {
      client = client.withCompany(company.companyId, {
        attributes: company.attrs,
      });

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            company: {
              id: "company123",
              ...company.attrs,
            },
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            company: {
              id: "company123",
              ...company.attrs,
            },
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );
    });

    it("should return evaluated flags when only custom context is defined", async () => {
      client = client.withCustomContext(customContext);

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            ...customContext,
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            ...customContext,
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );
    });

    it("should use fallback flags when getFeatureFlagDefinitions returns undefined", async () => {
      httpClient.get.mockResolvedValue({
        success: false,
      });

      await client.initialize(fallbackFlags);
      const result = client.getFlags();

      expect(result).toEqual(fallbackFlags);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          "failed to use feature flag definitions, there are none cached yet. using fallback flags.",
        ),
      );
      expect(httpClient.post).toHaveBeenCalledTimes(1); // For "evaluate" events

      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/flags/events",
        expectedPostHeaders,
        {
          action: "check",
          flagKey: "flagKey",
          evalResult: true,
        },
      );
    });

    it("should not fail if sendFeatureFlagEvent fails to send evaluate event", async () => {
      httpClient.post.mockRejectedValueOnce(new Error("Network error"));

      client = client
        .withUser(user.userId, { attributes: user.attrs })
        .withCompany(company.companyId, { attributes: company.attrs })
        .withCustomContext(customContext);

      await client.initialize(fallbackFlags);
      client.getFlags();

      await flushPromises();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          'post request to "flags/events" failed with error',
        ),
        expect.any(Error),
      );
    });

    it("should not fail if sendFeatureFlagEvent fails to send check event", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      client = client
        .withUser(user.userId, { attributes: user.attrs })
        .withCompany(company.companyId, { attributes: company.attrs })
        .withCustomContext(customContext);

      await client.initialize(fallbackFlags);
      const result = client.getFlags();

      httpClient.post.mockRejectedValueOnce(new Error("Network error"));

      // Trigger a flag check
      expect(result.flag1.value).toBe(true);

      await flushPromises();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(
          'post request to "flags/events" failed with error',
        ),
        expect.any(Error),
      );
    });
  });
});
