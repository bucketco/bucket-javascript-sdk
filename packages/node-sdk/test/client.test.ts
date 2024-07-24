import flushPromises from "flush-promises";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { evaluateFlag } from "@bucketco/flag-evaluation";

import { BucketClient, BucketClientClass } from "../src/client";
import {
  API_HOST,
  FLAG_EVENTS_PER_MIN,
  FLAGS_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "../src/config";
import fetchClient from "../src/fetch-http-client";
import { ClientOptions, FlagDefinitions } from "../src/types";
import { checkWithinAllottedTimeWindow } from "../src/utils";

vi.mock("@bucketco/flag-evaluation", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    evaluateFlag: vi.fn(),
  };
});

vi.mock("../src/utils", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    checkWithinAllottedTimeWindow: vi.fn(
      original.checkWithinAllottedTimeWindow,
    ),
  };
});

describe("BucketClientClass", () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const httpClient = { post: vi.fn(), get: vi.fn() };

  const fallbackFlags = {
    flagKey: true,
  };

  const validOptions: ClientOptions = {
    secretKey: "validSecretKeyWithMoreThan22Chars",
    host: "https://api.example.com",
    logger,
    httpClient,
    fallbackFlags,
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

  const otherContext = { custom: "context", key: "value" };

  const expectedHeaders = {
    [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
    "Content-Type": "application/json",
    Authorization: `Bearer ${validOptions.secretKey}`,
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor (with options)", () => {
    it("should create a client instance with valid options", () => {
      const client = new BucketClientClass(validOptions);

      expect(client).toBeInstanceOf(BucketClientClass);
      expect(client["_shared"].host).toBe("https://api.example.com");
      expect(client["_shared"].refetchInterval).toBe(FLAGS_REFETCH_MS);
      expect(client["_shared"].staleWarningInterval).toBe(FLAGS_REFETCH_MS * 5);
      expect(client["_shared"].logger).toBeDefined();
      expect(client["_shared"].httpClient).toBe(validOptions.httpClient);
      expect(client["_shared"].headers).toEqual(expectedHeaders);
      expect(client["_shared"].fallbackFlags).toEqual({
        flagKey: {
          key: "flagKey",
          value: true,
        },
      });
    });

    it("should route messages to the supplied logger", () => {
      const client = new BucketClientClass(validOptions);

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
      const client = new BucketClientClass({
        secretKey: "validSecretKeyWithMoreThan22Chars",
      });

      expect(client).toBeInstanceOf(BucketClientClass);
      expect(client["_shared"].host).toBe(API_HOST);
      expect(client["_shared"].refetchInterval).toBe(FLAGS_REFETCH_MS);
      expect(client["_shared"].staleWarningInterval).toBe(FLAGS_REFETCH_MS * 5);
      expect(client["_shared"].logger).toBeUndefined();
      expect(client["_shared"].httpClient).toBe(fetchClient);
      expect(client["_shared"].headers).toEqual(expectedHeaders);
      expect(client["_shared"].fallbackFlags).toBeUndefined();
    });

    it("should throw an error if options are invalid", () => {
      let invalidOptions: any = null;
      expect(() => new BucketClientClass(invalidOptions)).toThrow(
        "options must be an object",
      );

      invalidOptions = { ...validOptions, secretKey: "shortKey" };
      expect(() => new BucketClientClass(invalidOptions)).toThrow(
        "secretKey must be a string",
      );

      invalidOptions = { ...validOptions, host: 123 };
      expect(() => new BucketClientClass(invalidOptions)).toThrow(
        "host must be a string",
      );

      invalidOptions = {
        ...validOptions,
        logger: "invalidLogger" as any,
      };
      expect(() => new BucketClientClass(invalidOptions)).toThrow(
        "logger must be an object",
      );

      invalidOptions = {
        ...validOptions,
        httpClient: "invalidHttpClient" as any,
      };
      expect(() => new BucketClientClass(invalidOptions)).toThrow(
        "httpClient must be an object",
      );

      invalidOptions = {
        ...validOptions,
        fallbackFlags: "invalid" as any,
      };
      expect(() => new BucketClientClass(invalidOptions)).toThrow(
        "fallbackFlags must be an object",
      );
    });
  });

  describe("constructor (with existing client)", () => {
    const initialClient = new BucketClientClass(validOptions);

    initialClient["_otherContext"] = { key: "value" };
    initialClient["_company"] = {
      companyId: "123",
      attrs: {},
    };
    initialClient["_user"] = { userId: "abc", attrs: {} };

    it("should create a new client instance based on an existing client", () => {
      const newClient = new BucketClientClass(initialClient);

      expect(newClient).toBeInstanceOf(BucketClientClass);
      expect(newClient["_shared"]).toBe(initialClient["_shared"]);
      expect(newClient["_otherContext"]).toEqual(
        initialClient["_otherContext"],
      );
      expect(newClient["_company"]).toEqual(initialClient["_company"]);
      expect(newClient["_user"]).toEqual(initialClient["_user"]);
    });

    it("should create a new client instance and allow modifying context independently", () => {
      const newClient = new BucketClientClass(initialClient);
      newClient["_otherContext"] = { key: "newValue" };

      expect(newClient["_otherContext"]).not.toEqual(
        initialClient["_otherContext"],
      );
      expect(initialClient["_otherContext"]).toEqual({ key: "value" });
    });

    it("should create a new client instance and allow modifying company independently", () => {
      const newClient = new BucketClientClass(initialClient);
      newClient["_company"] = { companyId: "456", attrs: {} };

      expect(newClient["_company"]).not.toEqual(initialClient["_company"]);
      expect(initialClient["_company"]).toEqual({
        companyId: "123",
        attrs: {},
      });
    });

    it("should create a new client instance and allow modifying user independently", () => {
      const newClient = new BucketClientClass(initialClient);
      newClient["_user"] = { userId: "def", attrs: {} };

      expect(newClient["_user"]).not.toEqual(initialClient["_user"]);
      expect(initialClient["_user"]).toEqual({
        userId: "abc",
        attrs: {},
      });
    });
  });

  describe("withUser", () => {
    const client = new BucketClientClass(validOptions);

    it("should return a new client instance with the user set", () => {
      const newClient = client.withUser(user.userId, user.attrs);

      expect(newClient).toBeInstanceOf(BucketClientClass);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["_user"]).toEqual(user);
    });

    it("should update user in Bucket when called", () => {
      client.withUser(user.userId, user.attrs);

      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/user",
        expectedHeaders,
        {
          userId: user.userId,
          attributes: user.attrs,
        },
      );
    });

    it("should return a new client instance with merged user attributes", () => {
      const override = { sex: "male", age: 30 };
      const newClient = client
        .withUser(user.userId, user.attrs)
        .withUser(user.userId, override);

      expect(newClient["_user"]).toEqual({
        userId: user.userId,
        attrs: { ...user.attrs, ...override },
      });
    });

    it("should return a new client instance with reset user", () => {
      const newClient = client
        .withUser(user.userId, user.attrs)
        .withUser("anotherUser", { another: "value" });

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

      expect(() =>
        client.withUser(user.userId, "bad_attributes" as any),
      ).toThrow("attributes must be an object");
    });
  });

  describe("withCompany", () => {
    const client = new BucketClientClass(validOptions);

    it("should return a new client instance with the company set", () => {
      const newClient = client.withCompany(company.companyId, company.attrs);

      expect(newClient).toBeInstanceOf(BucketClientClass);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["company"]).toEqual(company);
    });

    it("should update company in Bucket when called", () => {
      client.withCompany(company.companyId, company.attrs);

      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        expectedHeaders,
        {
          companyId: company.companyId,
          attributes: company.attrs,
        },
      );
    });

    it("should return a new client instance with merged company attributes", () => {
      const override = { age: 30, name: "not acme" };
      const newClient = client
        .withCompany(company.companyId, company.attrs)
        .withCompany(company.companyId, override);

      expect(newClient["_company"]).toEqual({
        companyId: company.companyId,
        attrs: { ...company.attrs, ...override },
      });
    });

    it("should return a new client instance with reset company", () => {
      const newClient = client
        .withCompany(company.companyId, company.attrs)
        .withCompany("anotherCompany", { another: "value" });

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
        client.withCompany(company.companyId, "bad_attributes" as any),
      ).toThrow("attributes must be an object");
    });
  });

  describe("withOtherContext", () => {
    const client = new BucketClientClass(validOptions);

    it("should return a new client instance with the custom other set", () => {
      const newClient = client.withOtherContext(otherContext);

      expect(newClient).toBeInstanceOf(BucketClientClass);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["_otherContext"]).toEqual(otherContext);
    });

    it("should return a new client instance with replaced other context", () => {
      const newClient = client
        .withOtherContext(otherContext)
        .withOtherContext({ replaced: true });

      expect(newClient["_otherContext"]).toEqual({ replaced: true });
    });

    it("should throw an error if custom context is not an object", () => {
      expect(() => client.withOtherContext(null as any)).toThrow(
        "context must be an object",
      );
      expect(() => client.withOtherContext(123 as any)).toThrow(
        "context must be an object",
      );
      expect(() => client.withOtherContext("invalidContext" as any)).toThrow(
        "context must be an object",
      );
      expect(() => client.withOtherContext([] as any)).toThrow(
        "context must be an object",
      );
    });
  });

  describe("updateUser", () => {
    const client = new BucketClientClass(validOptions).withUser(
      user.userId,
      user.attrs,
    );

    it("should successfully update the user with merging attributes", async () => {
      const response = { status: 200, body: { success: true } };
      httpClient.post.mockResolvedValue(response);

      const result = await client.updateUser({
        attributes: { age: 2, brave: false },
        meta: {
          active: true,
        },
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/user",
        expectedHeaders,
        {
          userId: user.userId,
          attributes: { age: 2, brave: false, name: "John" },
          context: { active: true },
        },
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "user"'),
        response,
      );
    });

    it("should return false and log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const result = await client.updateUser();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "user" failed with error'),
        error,
      );
    });

    it("should return false if the API call fails", async () => {
      const response = { status: 200, body: { success: false } };

      httpClient.post.mockResolvedValue(response);

      const result = await client.updateUser();

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "user"'),
        response,
      );
    });

    it("should throw an error if opts are not valid or the user is not set", async () => {
      await expect(
        new BucketClientClass(validOptions).updateUser(),
      ).rejects.toThrow("user must be set");

      await expect(client.updateUser("bad_opts" as any)).rejects.toThrow(
        "opts must be an object",
      );

      await expect(
        client.updateUser({ attributes: "bad_attributes" as any }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.updateUser({ meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("updateCompany", () => {
    const client = new BucketClientClass(validOptions).withCompany(
      company.companyId,
      company.attrs,
    );

    it("should successfully update the company with merging attributes", async () => {
      const response = { status: 200, body: { success: true } };

      httpClient.post.mockResolvedValue(response);

      const result = await client.updateCompany({
        attributes: { employees: 200, bankrupt: false },
        meta: { active: true },
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        expectedHeaders,
        {
          companyId: company.companyId,
          attributes: { employees: 200, bankrupt: false, name: "Acme Inc." },
          context: { active: true },
        },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company"'),
        response,
      );
    });

    it("should include the user ID as well, if user was set", async () => {
      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const result = await client.withUser(user.userId).updateCompany();

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/company",
        expectedHeaders,
        {
          companyId: company.companyId,
          userId: user.userId,
          attributes: {
            employees: 100,
            name: "Acme Inc.",
          },
        },
      );
    });

    it("should return false and log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      const result = await client.updateCompany();

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company" failed with error'),
        error,
      );
    });

    it("should return false if the API responds with success: false", async () => {
      const response = {
        status: 200,
        body: { success: false },
      };
      httpClient.post.mockResolvedValue(response);

      const result = await client.updateCompany();

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "company"'),
        response,
      );
    });

    it("should throw an error if company is not valid", async () => {
      await expect(
        new BucketClientClass(validOptions).updateCompany(),
      ).rejects.toThrow("company must be set");

      await expect(client.updateCompany("bad_opts" as any)).rejects.toThrow(
        "opts must be an object",
      );

      await expect(
        client.updateCompany({
          attributes: "bad_attributes" as any,
        }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.updateCompany({
          meta: "bad_meta" as any,
        }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("trackFeatureUsage", () => {
    const client = new BucketClientClass(validOptions).withUser(user.userId);

    it("should successfully track the feature usage", async () => {
      const response = {
        status: 200,
        body: { success: true },
      };
      httpClient.post.mockResolvedValue(response);

      const result = await client.trackFeatureUsage(event.event, {
        attributes: event.attrs,
        meta: { active: true },
      });

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        expectedHeaders,
        {
          event: event.event,
          userId: user.userId,
          attributes: event.attrs,
          context: { active: true },
        },
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "event"'),
        response,
      );
    });

    it("should successfully track the feature usage including user and company", async () => {
      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      const result = await client
        .withUser(user.userId)
        .withCompany(company.companyId)
        .trackFeatureUsage(event.event);

      expect(result).toBe(true);
      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/event",
        expectedHeaders,
        {
          event: event.event,
          companyId: company.companyId,
          userId: user.userId,
        },
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

    it("should return false if the API call fails", async () => {
      const response = {
        status: 200,
        body: { success: false },
      };
      httpClient.post.mockResolvedValue(response);

      const result = await client.trackFeatureUsage(event.event);

      expect(result).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "event"'),
        response,
      );
    });

    it("should throw an error if user is not set", async () => {
      await expect(
        new BucketClientClass(validOptions).trackFeatureUsage("hello"),
      ).rejects.toThrow("user must be set");
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
      const client = new BucketClientClass(validOptions);
      expect(client.user).toBeUndefined();
    });

    it("should return the user if user was associated", () => {
      const client = new BucketClientClass(validOptions).withUser(
        user.userId,
        user.attrs,
      );

      expect(client.user).toEqual(user);
    });
  });

  describe("company", () => {
    it("should return the undefined if company was not set", () => {
      const client = new BucketClientClass(validOptions);
      expect(client.company).toBeUndefined();
    });

    it("should return the user if company was associated", () => {
      const client = new BucketClientClass(validOptions).withCompany(
        company.companyId,
        company.attrs,
      );

      expect(client.company).toEqual(company);
    });
  });

  describe("otherContext", () => {
    it("should return the undefined if custom context was not set", () => {
      const client = new BucketClientClass(validOptions);
      expect(client.otherContext).toBeUndefined();
    });

    it("should return the user if custom context was associated", () => {
      const client = new BucketClientClass(validOptions).withOtherContext(
        otherContext,
      );

      expect(client.otherContext).toEqual(otherContext);
    });
  });

  describe("initialize", () => {
    it("should initialize the client", async () => {
      const client = new BucketClientClass(validOptions);

      const cache = {
        refresh: vi.fn(),
        get: vi.fn(),
      };

      vi.spyOn(client as any, "getFeatureFlagDefinitionCache").mockReturnValue(
        cache,
      );

      await client.initialize();

      expect(cache.refresh).toHaveBeenCalledTimes(1);
      expect(cache.get).not.toHaveBeenCalled();
    });

    it("should set up the cache object", async () => {
      const client = new BucketClientClass(validOptions);
      expect(client["_shared"].featureFlagDefinitionCache).toBeUndefined();

      await client.initialize();
      expect(client["_shared"].featureFlagDefinitionCache).toBeTypeOf("object");
    });

    it("should call the backend to obtain flags", async () => {
      const client = new BucketClientClass(validOptions);
      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledWith(
        `https://api.example.com/flags`,
        expectedHeaders,
      );
    });
  });

  describe("getFlags", () => {
    let client: BucketClientClass;

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
      httpClient.get.mockResolvedValue({
        status: 200,
        body: {
          success: true,
          ...flagDefinitions,
        },
      });

      client = new BucketClientClass(validOptions);

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

      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });
    });

    it("should return evaluated flags when user, company, and custom context are defined", async () => {
      client = client
        .withUser(user.userId, user.attrs)
        .withCompany(company.companyId, company.attrs)
        .withOtherContext(otherContext);

      httpClient.post.mockClear(); // not interested in updates

      await flushPromises();

      await client.initialize();
      const result = client.getFlags();

      expect(result).toEqual({
        flag1: true,
      });

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(3); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedHeaders,
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
            ...otherContext,
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        expectedHeaders,
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
            ...otherContext,
          },
          evalResult: false,
          evalRuleResults: [false],
          evalMissingFields: ["something"],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        3,
        "https://api.example.com/flags/events",
        expectedHeaders,
        {
          action: "check",
          flagKey: "flag1",
          flagVersion: 1,
          evalResult: true,
        },
      );
    });

    it("should properly define the rate limiter key", async () => {
      client = client
        .withUser(user.userId, user.attrs)
        .withCompany(company.companyId, company.attrs)
        .withOtherContext(otherContext);

      await client.initialize();
      client.getFlags();

      expect(checkWithinAllottedTimeWindow).toHaveBeenCalledWith(
        FLAG_EVENTS_PER_MIN,
        "evaluate:user.id=user123&user.age=1&user.name=John&company.id=company123&company.employees=100&company.name=Acme+Inc.&custom=context&key=value:flag1:1:true",
      );
      //      vi.mocked(rateLimited).mockRestore();
    });

    it("should return evaluated flags when only user is defined", async () => {
      client = client.withUser(user.userId, user.attrs);

      httpClient.post.mockClear(); // not interested in updates
      await flushPromises();

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedHeaders,
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
        expectedHeaders,
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
      client = client.withCompany(company.companyId, company.attrs);

      httpClient.post.mockClear(); // not interested in updates
      await flushPromises();

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedHeaders,
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
        expectedHeaders,
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

    it("should return evaluated flags when only other context is defined", async () => {
      client = client.withOtherContext(otherContext);

      await client.initialize();
      client.getFlags();

      expect(evaluateFlag).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(2); // For "evaluate" events

      expect(httpClient.post).toHaveBeenNthCalledWith(
        1,
        "https://api.example.com/flags/events",
        expectedHeaders,
        {
          action: "evaluate",
          flagKey: "flag1",
          flagVersion: 1,
          evalContext: {
            ...otherContext,
          },
          evalResult: true,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      );

      expect(httpClient.post).toHaveBeenNthCalledWith(
        2,
        "https://api.example.com/flags/events",
        expectedHeaders,
        {
          action: "evaluate",
          flagKey: "flag2",
          flagVersion: 2,
          evalContext: {
            ...otherContext,
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

      await client.initialize();
      const result = client.getFlags();

      expect(result).toEqual({
        flagKey: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          "failed to use feature flag definitions, there are none cached yet. using fallback flags.",
        ),
      );
      expect(httpClient.post).toHaveBeenCalledTimes(1); // For "evaluate" events

      expect(httpClient.post).toHaveBeenCalledWith(
        "https://api.example.com/flags/events",
        expectedHeaders,
        {
          action: "check",
          flagKey: "flagKey",
          evalResult: true,
        },
      );
    });

    it("should not fail if sendFeatureFlagEvent fails to send evaluate event", async () => {
      client = client.withUser("fancyUser");

      httpClient.post.mockClear(); // not interested in updates
      await flushPromises();

      httpClient.post.mockRejectedValueOnce(new Error("Network error"));

      await client.initialize();
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
      client = client.withUser("anotherUser");

      httpClient.post.mockClear(); // not interested in updates
      await flushPromises();

      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      await client.initialize();
      httpClient.post.mockRejectedValueOnce(new Error("Network error"));

      await flushPromises();

      const result = client.getFlags();

      // Trigger a flag check
      expect(result.flag1).toBe(true);

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

describe("BucketClient", () => {
  const httpClient = { post: vi.fn(), get: vi.fn() };

  beforeAll(() => {
    const response = {
      status: 200,
      body: { success: true },
    };
    httpClient.post.mockResolvedValue(response);
  });

  const client = BucketClient({
    secretKey: "validSecretKeyWithMoreThan22Chars",
    httpClient,
  });

  it("should create a client instance", () => {
    expect(client).toBeInstanceOf(BucketClientClass);
  });

  describe("type safety", () => {
    it("should allow using expected methods without being bound", async () => {
      expect(client.withOtherContext({ key: "value" }).otherContext).toEqual({
        key: "value",
      });

      await client.initialize();
      client.getFlags();
    });

    it("should allow using expected methods when bound to user", async () => {
      const bound = client.withUser("user");
      expect(bound.user).toEqual({ userId: "user" });

      expect(bound.withOtherContext({ key: "value" }).otherContext).toEqual({
        key: "value",
      });

      await bound.initialize();
      bound.getFlags();

      await bound.updateUser();
      await bound.trackFeatureUsage("feature");

      await bound.withCompany("company").updateCompany();
    });

    it("should allow using expected methods when bound to company", async () => {
      const bound = client.withCompany("company");
      expect(bound.company).toEqual({ companyId: "company" });

      expect(bound.withOtherContext({ key: "value" }).otherContext).toEqual({
        key: "value",
      });

      await bound.initialize();
      bound.getFlags();

      await bound.updateCompany();

      await bound.withUser("user").updateUser();
    });

    it("should allow using expected methods when bound to company and user", async () => {
      const bound = client.withUser("user").withCompany("company");
      expect(bound.company).toEqual({ companyId: "company" });
      expect(bound.user).toEqual({ userId: "user" });

      expect(bound.withOtherContext({ key: "value" }).otherContext).toEqual({
        key: "value",
      });

      await bound.initialize();
      bound.getFlags();

      await bound.updateCompany();
      await bound.updateUser();
      await bound.trackFeatureUsage("feature");
    });
  });
});
