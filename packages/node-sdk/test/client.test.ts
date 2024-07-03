import flushPromises from "flush-promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateFlag } from "@bucketco/flag-evaluation";

import { Client } from "../src/client";
import { API_HOST, FLAGS_REFETCH_MS } from "../src/config";
import fetchClient from "../src/fetch-http-client";
import {
  ClientOptions,
  Company,
  Event,
  FlagDefinitions,
  Flags,
  User,
} from "../src/types";

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

  const user: User = {
    userId: "user123",
    attributes: { attributeKey: "attributeValue" },
    context: { active: true },
  };

  const company: Company = {
    companyId: "company123",
    attributes: { attributeKey: "attributeValue" },
    context: { active: true },
  };

  const event: Event = {
    event: "testEvent",
    attributes: { key: "value" },
    context: { active: true },
  };

  const customContext = { custom: "context" };

  describe("constructor (with options)", () => {
    it("should create a client instance with valid options", () => {
      const client = new Client(validOptions);

      expect(client).toBeInstanceOf(Client);
      expect(client["shared"].host).toBe("https://api.example.com");
      expect(client["shared"].refetchInterval).toBe(61000);
      expect(client["shared"].staleWarningInterval).toBe(310000);
      expect(client["shared"].logger).toBe(validOptions.logger);
      expect(client["shared"].httpClient).toBe(validOptions.httpClient);
    });

    it("should create a client instance with default values for optional fields", () => {
      const client = new Client({
        secretKey: "validSecretKeyWithMoreThan22Chars",
      });

      expect(client).toBeInstanceOf(Client);
      expect(client["shared"].host).toBe(API_HOST);
      expect(client["shared"].refetchInterval).toBe(FLAGS_REFETCH_MS);
      expect(client["shared"].staleWarningInterval).toBe(FLAGS_REFETCH_MS * 5);
      expect(client["shared"].logger).toBeUndefined();
      expect(client["shared"].httpClient).toBe(fetchClient);
    });

    it("should throw an error if options are invalid", () => {
      let invalidOptions: any = null;
      expect(() => new Client(invalidOptions)).toThrow(
        "options must be an object",
      );

      invalidOptions = { ...validOptions, secretKey: "shortKey" };
      expect(() => new Client(invalidOptions)).toThrow(
        "secretKey must be a string",
      );

      invalidOptions = { ...validOptions, host: 123 };
      expect(() => new Client(invalidOptions)).toThrow("host must be a string");

      invalidOptions = {
        ...validOptions,
        logger: "invalidLogger" as any,
      };
      expect(() => new Client(invalidOptions)).toThrow(
        "logger must be an object",
      );

      invalidOptions = {
        ...validOptions,
        httpClient: "invalidHttpClient" as any,
      };
      expect(() => new Client(invalidOptions)).toThrow(
        "httpClient must be an object",
      );

      invalidOptions = {
        ...validOptions,
        refetchInterval: "notANumber" as any,
      };
      expect(() => new Client(invalidOptions)).toThrow(
        "refetchInterval must be a number",
      );

      invalidOptions = {
        ...validOptions,
        staleWarningInterval: "notANumber" as any,
      };
      expect(() => new Client(invalidOptions)).toThrow(
        "staleWarningInterval must be a number",
      );
    });
  });

  describe("constructor (with existing client)", () => {
    const initialClient = new Client(validOptions);

    initialClient["context"] = { key: "value" };
    initialClient["company"] = {
      companyId: "123",
      attributes: {},
      context: {},
    };
    initialClient["user"] = { userId: "abc", attributes: {}, context: {} };
    initialClient["fallbackFlags"] = {
      flagKey: { key: "flagKey", value: true, version: 1 },
    };

    it("should create a new client instance based on an existing client", () => {
      const newClient = new Client(initialClient);

      expect(newClient).toBeInstanceOf(Client);
      expect(newClient["shared"]).toBe(initialClient["shared"]);
      expect(newClient["context"]).toEqual(initialClient["context"]);
      expect(newClient["company"]).toEqual(initialClient["company"]);
      expect(newClient["user"]).toEqual(initialClient["user"]);
      expect(newClient["fallbackFlags"]).toEqual(
        initialClient["fallbackFlags"],
      );
    });

    it("should create a new client instance and allow modifying context independently", () => {
      const newClient = new Client(initialClient);
      newClient["context"] = { key: "newValue" };

      expect(newClient["context"]).not.toEqual(initialClient["context"]);
      expect(initialClient["context"]).toEqual({ key: "value" });
    });

    it("should create a new client instance and allow modifying company independently", () => {
      const newClient = new Client(initialClient);
      newClient["company"] = { companyId: "456", attributes: {}, context: {} };

      expect(newClient["company"]).not.toEqual(initialClient["company"]);
      expect(initialClient["company"]).toEqual({
        companyId: "123",
        attributes: {},
        context: {},
      });
    });

    it("should create a new client instance and allow modifying user independently", () => {
      const newClient = new Client(initialClient);
      newClient["user"] = { userId: "def", attributes: {}, context: {} };

      expect(newClient["user"]).not.toEqual(initialClient["user"]);
      expect(initialClient["user"]).toEqual({
        userId: "abc",
        attributes: {},
        context: {},
      });
    });

    it("should create a new client instance and allow modifying fallbackFlags independently", () => {
      const newClient = new Client(initialClient);
      newClient["fallbackFlags"] = {
        flagKey: { key: "flagKey", value: false, version: 2 },
      };

      expect(newClient["fallbackFlags"]).not.toEqual(
        initialClient["fallbackFlags"],
      );
      expect(initialClient["fallbackFlags"]).toEqual({
        flagKey: { key: "flagKey", value: true, version: 1 },
      });
    });
  });

  describe("withUser", () => {
    const client = new Client(validOptions);

    it("should return a new client instance with the user set", () => {
      const newClient = client.withUser(user);

      expect(newClient).toBeInstanceOf(Client);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["user"]).toEqual(user);
    });

    it("should throw an error if user is invalid", () => {
      let invalidUser: any = null;

      expect(() => client.withUser(invalidUser)).toThrow(
        "user must be an object",
      );

      invalidUser = { ...user, userId: "" };
      expect(() => client.withUser(invalidUser)).toThrow(
        "user must have a userId",
      );

      invalidUser = { ...user, attributes: "invalidAttributes" };
      expect(() => client.withUser(invalidUser)).toThrow(
        "user attributes must be an object",
      );

      invalidUser = { ...user, context: "invalidContext" };
      expect(() => client.withUser(invalidUser)).toThrow(
        "user context must be an object",
      );
    });
  });

  describe("withCompany", () => {
    const client = new Client(validOptions);

    it("should return a new client instance with the company set", () => {
      const newClient = client.withCompany(company);

      expect(newClient).toBeInstanceOf(Client);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["company"]).toEqual(company);
    });

    it("should throw an error if user is invalid", () => {
      let invalidCompany: any = null;

      expect(() => client.withCompany(invalidCompany)).toThrow(
        "company must be an object",
      );

      invalidCompany = { ...company, companyId: "" };
      expect(() => client.withCompany(invalidCompany)).toThrow(
        "company must have a companyId",
      );

      invalidCompany = { ...company, attributes: "invalidAttributes" };
      expect(() => client.withCompany(invalidCompany)).toThrow(
        "company attributes must be an object",
      );

      invalidCompany = { ...company, context: "invalidContext" };
      expect(() => client.withCompany(invalidCompany)).toThrow(
        "company context must be an object",
      );
    });
  });

  describe("withCustomContext", () => {
    const client = new Client(validOptions);

    it("should return a new client instance with the custom context set", () => {
      const newClient = client.withCustomContext(customContext);

      expect(newClient).toBeInstanceOf(Client);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["context"]).toEqual(customContext);
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

  describe("updateUser", () => {
    it("should successfully update the user when user is defined", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const client = new Client(validOptions).withUser(user);
      const result = await client.updateUser();

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/user",
        client["shared"].headers,
        user,
      );
      expect(logger.debug).toHaveBeenCalledWith('post request to "user"', true);
    });

    it("should return false and log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const client = new Client(validOptions).withUser(user);
      const result = await client.updateUser();

      expect(result).toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/user",
        client["shared"].headers,
        user,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'post request to "user" failed with error',
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      httpClient.post.mockResolvedValue({ success: false });

      const client = new Client(validOptions).withUser(user);
      const result = await client.updateUser();

      expect(result).toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/user",
        client["shared"].headers,
        user,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'post request to "user"',
        false,
      );
    });

    it("should throw an error if user is not defined", async () => {
      const client = new Client(validOptions);
      await expect(client.updateUser()).rejects.toThrow("user is not defined");
    });
  });

  describe("updateCompany", () => {
    it("should successfully update the company when company is defined", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const client = new Client(validOptions).withCompany(company);
      const result = await client.updateCompany();

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        client["shared"].headers,
        company,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'post request to "company"',
        true,
      );
    });

    it("should include the user ID as well, if user was defined", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const client = new Client(validOptions)
        .withCompany(company)
        .withUser(user);
      const result = await client.updateCompany();

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        client["shared"].headers,
        { ...company, userId: user.userId },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'post request to "company"',
        true,
      );
    });

    it("should return false and log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const client = new Client(validOptions).withCompany(company);
      const result = await client.updateCompany();

      expect(result).toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        client["shared"].headers,
        company,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'post request to "company" failed with error',
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      httpClient.post.mockResolvedValue({ success: false });

      const client = new Client(validOptions).withCompany(company);
      const result = await client.updateCompany();

      expect(result).toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        client["shared"].headers,
        company,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'post request to "user"',
        false,
      );
    });

    it("should throw an error if user is not defined", async () => {
      const client = new Client(validOptions);
      await expect(client.updateCompany()).rejects.toThrow(
        "company is not defined",
      );
    });
  });

  describe("trackFeatureUsage", () => {
    const client = new Client(validOptions);

    it("should successfully track the feature usage", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      const result = await client.trackFeatureUsage(event);

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        client["shared"].headers,
        event,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'post request to "event"',
        true,
      );
    });

    it("should return false and log an error if the post request fails", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const result = await client.trackFeatureUsage(event);

      expect(result).toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        client["shared"].headers,
        event,
      );
      expect(logger.error).toHaveBeenCalledWith(
        'post request to "event" failed with error',
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      httpClient.post.mockResolvedValue({ success: false });

      const result = await client.trackFeatureUsage(event);

      expect(result).toBe(false);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        client["shared"].headers,
        event,
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'post request to "event"',
        false,
      );
    });

    it("should throw an error if event is not an object", async () => {
      let invalidEvent: any = null;
      await expect(client.trackFeatureUsage(invalidEvent)).rejects.toThrow(
        "event must be an object",
      );

      invalidEvent = { ...event, event: "" };
      await expect(client.trackFeatureUsage(invalidEvent)).rejects.toThrow(
        "event must have a name",
      );

      invalidEvent = { ...event, attributes: "invalidAttributes" };
      await expect(client.trackFeatureUsage(invalidEvent)).rejects.toThrow(
        "event attributes must be an object",
      );

      invalidEvent = { ...event, context: "invalidContext" };
      await expect(client.trackFeatureUsage(invalidEvent)).rejects.toThrow(
        "event context must be an object",
      );
    });
  });

  describe("initialize", () => {
    it("should initialize the client and set fallbackFlags", async () => {
      const client = new Client(validOptions);
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

      expect(client["fallbackFlags"]).toEqual(fallbackFlags);
      expect(cache.refresh).toHaveBeenCalledTimes(1);
      expect(cache.get).not.toHaveBeenCalled();
    });

    it("should initialize the client without fallbackFlags", async () => {
      const client = new Client(validOptions);

      const cache = {
        refresh: vi.fn(),
        get: vi.fn(),
      };

      vi.spyOn(client as any, "getFeatureFlagDefinitionCache").mockReturnValue(
        cache,
      );

      await client.initialize();

      expect(client["fallbackFlags"]).toBeUndefined();
      expect(cache.refresh).toHaveBeenCalledTimes(1);
      expect(cache.get).not.toHaveBeenCalled();
    });

    it("should set up the getFeatureFlagDefinitionsFn function", async () => {
      const client = new Client(validOptions);
      expect(client["shared"].featureFlagDefinitionCache).toBeUndefined();

      await client.initialize();
      expect(client["shared"].featureFlagDefinitionCache).toBeTypeOf("object");
    });

    it("should throw an error if fallbackFlags is not an object", async () => {
      const client = new Client(validOptions);

      await expect(client.initialize("invalidFlags" as any)).rejects.toThrow(
        "fallbackFlags must be an object",
      );
    });
  });

  describe("getFlags", () => {
    let client: Client;

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
              contextFilter: [
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
              segment: {
                id: "segmentId",
                attributeFilter: [
                  {
                    field: "attributeKey",
                    operator: "IS",
                    values: ["attributeValue"],
                  },
                ],
              },
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

      client = new Client(validOptions);

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
        .withUser(user)
        .withCompany(company)
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
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            company: {
              attributeKey: "attributeValue",
              id: "company123",
            },
            custom: "context",
            user: {
              attributeKey: "attributeValue",
              id: "user123",
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
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            company: {
              attributeKey: "attributeValue",
              id: "company123",
            },
            custom: "context",
            user: {
              attributeKey: "attributeValue",
              id: "user123",
            },
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        3,
        "https://api.example.com/flags/events",
        client["shared"].headers,
        {
          action: "check",
          flagKey: "flag1",
          flagVersion: 1,
          evalResult: true,
        },
      );
    });

    it("should return evaluated flags when only user is defined", async () => {
      client = client.withUser(user);

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            user: {
              attributeKey: "attributeValue",
              id: "user123",
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
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            user: {
              attributeKey: "attributeValue",
              id: "user123",
            },
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );
    });

    it("should return evaluated flags when only company is defined", async () => {
      client = client.withCompany(company);

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            company: {
              attributeKey: "attributeValue",
              id: "company123",
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
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            company: {
              attributeKey: "attributeValue",
              id: "company123",
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
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            custom: "context",
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        client["shared"].headers,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            custom: "context",
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
        "failed to use feature flag definitions, there are none cached yet. using fallback flags.",
      );
      expect(httpClient.post).toHaveBeenCalledTimes(1); // For "evaluate" events

      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/flags/events",
        client["shared"].headers,
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
        .withUser(user)
        .withCompany(company)
        .withCustomContext(customContext);

      await client.initialize(fallbackFlags);
      client.getFlags();

      await flushPromises();

      expect(logger.error).toHaveBeenCalledWith(
        'post request to "flags/events" failed with error',
        expect.any(Error),
      );
    });

    it("should not fail if sendFeatureFlagEvent fails to send check event", async () => {
      httpClient.post.mockResolvedValue({ success: true });

      client = client
        .withUser(user)
        .withCompany(company)
        .withCustomContext(customContext);

      await client.initialize(fallbackFlags);
      const result = client.getFlags();

      httpClient.post.mockRejectedValueOnce(new Error("Network error"));

      // Trigger a flag check
      expect(result.flag1.value).toBe(true);

      await flushPromises();

      expect(logger.error).toHaveBeenCalledWith(
        'post request to "flags/events" failed with error',
        expect.any(Error),
      );
    });
  });
});
