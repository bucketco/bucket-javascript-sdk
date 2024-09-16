import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { evaluateTargeting } from "@bucketco/flag-evaluation";

import { BoundBucketClient, BucketClient } from "../src/client";
import {
  API_HOST,
  BATCH_INTERVAL_MS,
  BATCH_MAX_RETRIES,
  BATCH_MAX_SIZE,
  BATCH_RETRY_INTERVAL_MS,
  FEATURE_EVENTS_PER_MIN,
  FEATURES_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "../src/config";
import fetchClient from "../src/fetch-http-client";
import { ClientOptions, FeaturesAPIResponse } from "../src/types";
import { checkWithinAllottedTimeWindow, clearRateLimiter } from "../src/utils";

const BULK_ENDPOINT = "https://api.example.com/bulk";

vi.mock("@bucketco/flag-evaluation", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    evaluateTargeting: vi.fn(),
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

const user = {
  id: "user123",
  age: 1,
  name: "John",
};

const company = {
  id: "company123",
  employees: 100,
  name: "Acme Inc.",
};

const otherContext = { custom: "context", key: "value" };

describe("BucketClient", () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const httpClient = { post: vi.fn(), get: vi.fn() };

  const fallbackFeatures = ["key"];

  const validOptions: ClientOptions = {
    secretKey: "validSecretKeyWithMoreThan22Chars",
    host: "https://api.example.com",
    logger,
    httpClient,
    fallbackFeatures,
    batchOptions: {
      maxSize: 99,
      intervalMs: 100,
      maxRetries: 1,
      retryIntervalMs: 200,
    },
  };

  const expectedHeaders = {
    [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
    "Content-Type": "application/json",
    Authorization: `Bearer ${validOptions.secretKey}`,
  };

  afterEach(() => {
    vi.clearAllMocks();
    clearRateLimiter();
  });

  describe("constructor (with options)", () => {
    it("should create a client instance with valid options", () => {
      const client = new BucketClient(validOptions);

      expect(client).toBeInstanceOf(BucketClient);
      expect(client["_config"].host).toBe("https://api.example.com");
      expect(client["_config"].refetchInterval).toBe(FEATURES_REFETCH_MS);
      expect(client["_config"].staleWarningInterval).toBe(
        FEATURES_REFETCH_MS * 5,
      );
      expect(client["_config"].logger).toBeDefined();
      expect(client["_config"].httpClient).toBe(validOptions.httpClient);
      expect(client["_config"].headers).toEqual(expectedHeaders);
      expect(client["_config"].batchBuffer).toMatchObject({
        maxSize: 99,
        intervalMs: 100,
        maxRetries: 1,
        retryIntervalMs: 200,
      });

      expect(client["_config"].fallbackFeatures).toEqual({
        key: {
          key: "key",
          isEnabled: true,
        },
      });
    });

    it("should route messages to the supplied logger", () => {
      const client = new BucketClient(validOptions);

      const actualLogger = client["_config"].logger!;
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

      expect(client["_config"].host).toBe(API_HOST);
      expect(client["_config"].refetchInterval).toBe(FEATURES_REFETCH_MS);
      expect(client["_config"].staleWarningInterval).toBe(
        FEATURES_REFETCH_MS * 5,
      );
      expect(client["_config"].logger).toBeUndefined();
      expect(client["_config"].httpClient).toBe(fetchClient);
      expect(client["_config"].headers).toEqual(expectedHeaders);
      expect(client["_config"].fallbackFeatures).toBeUndefined();
      expect(client["_config"].batchBuffer).toMatchObject({
        maxSize: BATCH_MAX_SIZE,
        intervalMs: BATCH_INTERVAL_MS,
        maxRetries: BATCH_MAX_RETRIES,
        retryIntervalMs: BATCH_RETRY_INTERVAL_MS,
      });
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
        batchOptions: "invalid" as any,
      };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "batchOptions must be an object",
      );

      invalidOptions = {
        ...validOptions,
        fallbackFeatures: "invalid" as any,
      };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "fallbackFeatures must be an object",
      );
    });
  });

  describe("bindClient", () => {
    beforeEach(() => {
      vi.mocked(httpClient.post).mockResolvedValue({ body: { success: true } });
    });

    const client = new BucketClient(validOptions);
    const context = {
      user,
      company,
    };

    it("should return a new client instance with the user set", async () => {
      const newClient = client.bindClient(context);
      await client.flush();

      expect(newClient).toBeInstanceOf(BoundBucketClient);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["_context"]).toEqual(context);
    });

    it("should update user in Bucket when called", async () => {
      client.bindClient({ user: context.user });
      await client.flush();

      const { id: _, ...attributes } = context.user;

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "user",
            userId: user.id,
            attributes: attributes,
            context: {
              active: false,
            },
          },
        ],
      );

      expect(httpClient.post).toHaveBeenCalledOnce();
    });

    it("should update company in Bucket when called", async () => {
      client.bindClient({ company: context.company });
      await client.flush();

      const { id: _, ...attributes } = context.company;

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "company",
            companyId: company.id,
            attributes: attributes,
            context: {
              active: false,
            },
          },
        ],
      );

      expect(httpClient.post).toHaveBeenCalledOnce();
    });

    it("should throw an error if user is invalid", () => {
      expect(() =>
        client.bindClient({ user: "bad_attributes" as any }),
      ).toThrow("validation failed: user.id must be a string if user is given");
      expect(() =>
        client.bindClient({ user: { id: undefined as any } }),
      ).toThrow("validation failed: user.id must be a string if user is given");
      expect(() => client.bindClient({ user: { id: 1 as any } })).toThrow(
        "validation failed: user.id must be a string if user is given",
      );
    });

    it("should throw an error if company is invalid", () => {
      expect(() =>
        client.bindClient({ company: "bad_attributes" as any }),
      ).toThrow(
        "validation failed: company.id must be a string if company is given",
      );

      expect(() =>
        client.bindClient({ company: { id: undefined as any } }),
      ).toThrow(
        "validation failed: company.id must be a string if company is given",
      );

      expect(() => client.bindClient({ company: { id: 1 as any } })).toThrow(
        "validation failed: company.id must be a string if company is given",
      );
    });

    it("should throw an error if other is invalid", () => {
      expect(() =>
        client.bindClient({ other: "bad_attributes" as any }),
      ).toThrow("validation failed: other must be an object");
    });
  });

  describe("updateUser", () => {
    const client = new BucketClient(validOptions);

    it("should successfully update the user", async () => {
      const response = { status: 200, body: { success: true } };
      httpClient.post.mockResolvedValue(response);

      await client.updateUser(user.id, {
        attributes: { age: 2, brave: false },
        meta: {
          active: true,
        },
      });

      await client.flush();

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "user",
            userId: user.id,
            attributes: { age: 2, brave: false },
            context: { active: true },
          },
        ],
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "bulk"'),
        response,
      );
    });

    it("should log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      await client.updateUser(user.id);
      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "bulk" failed with error'),
        error,
      );
    });

    it("should log if API call returns false", async () => {
      const response = { status: 200, body: { success: false } };

      httpClient.post.mockResolvedValue(response);

      await client.updateUser(user.id);
      await client.flush();

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching('post request to "bulk"'),
        response,
      );
    });

    it("should throw an error if opts are not valid or the user is not set", async () => {
      await expect(
        client.updateUser(user.id, "bad_opts" as any),
      ).rejects.toThrow("opts must be an object");

      await expect(
        client.updateUser(user.id, { attributes: "bad_attributes" as any }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.updateUser(user.id, { meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("updateCompany", () => {
    const client = new BucketClient(validOptions).withCompany(
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
        new BucketClient(validOptions).updateCompany(),
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
    const client = new BucketClient(validOptions).withUser(user.userId);

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
        new BucketClient(validOptions).track("hello"),
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
      const client = new BucketClient(validOptions);
      expect(client.user).toBeUndefined();
    });

    it("should return the user if user was associated", () => {
      const client = new BucketClient(validOptions).withUser(
        user.userId,
        user.attrs,
      );

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
        company.attrs,
      );

      expect(client.company).toEqual(company);
    });
  });

  describe("otherContext", () => {
    it("should return the undefined if custom context was not set", () => {
      const client = new BucketClient(validOptions);
      expect(client.otherContext).toBeUndefined();
    });

    it("should return the user if custom context was associated", () => {
      const client = new BucketClient(validOptions).withOtherContext(
        otherContext,
      );

      expect(client.otherContext).toEqual(otherContext);
    });
  });

  describe("initialize", () => {
    it("should initialize the client", async () => {
      const client = new BucketClient(validOptions);

      const cache = {
        refresh: vi.fn(),
        get: vi.fn(),
      };

      vi.spyOn(client as any, "getFeaturesCache").mockReturnValue(cache);

      await client.initialize();

      expect(cache.refresh).toHaveBeenCalledTimes(1);
      expect(cache.get).not.toHaveBeenCalled();
    });

    it("should set up the cache object", async () => {
      const client = new BucketClient(validOptions);
      expect(client["_config"].featuresCache).toBeUndefined();

      await client.initialize();
      expect(client["_config"].featuresCache).toBeTypeOf("object");
    });

    it("should call the backend to obtain features", async () => {
      const client = new BucketClient(validOptions);
      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledWith(
        `https://api.example.com/features`,
        expectedHeaders,
      );
    });
  });

  describe("getFeatures", () => {
    let client: BucketClient;

    const featureDefinitions: FeaturesAPIResponse = {
      features: [
        {
          key: "feature1",
          targeting: {
            version: 1,
            rules: [
              {
                filter: {
                  type: "context" as const,
                  field: "company.id",
                  operator: "IS",
                  values: ["company123"],
                },
              },
            ],
          },
        },
        {
          key: "feature2",
          targeting: {
            version: 2,
            rules: [
              {
                filter: {
                  type: "group" as const,
                  operator: "and",
                  filters: [
                    {
                      type: "context" as const,
                      field: "company.id",
                      operator: "IS",
                      values: ["company123"],
                    },
                    {
                      partialRolloutThreshold: 0.5,
                      partialRolloutAttribute: "attributeKey",
                      type: "rolloutPercentage" as const,
                      key: "feature2",
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    const evaluatedFeatures = [
      {
        feature: { key: "feature1", version: 1 },
        value: true,
        context: {},
        ruleEvaluationResults: [true],
        missingContextFields: [],
      },
      {
        feature: { key: "feature2", version: 2 },
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
          ...featureDefinitions,
        },
      });

      client = new BucketClient(validOptions);

      vi.mocked(evaluateTargeting).mockImplementation(
        ({ feature, context }) => {
          const evalFeature = evaluatedFeatures.find(
            (f) => f.feature.key === feature.key,
          )!;
          const featureDef = featureDefinitions.features.find(
            (f) => f.key === feature.key,
          )!;

          return {
            value: evalFeature.value,
            feature: featureDef,
            context: context,
            ruleEvaluationResults: evalFeature.ruleEvaluationResults,
            missingContextFields: evalFeature.missingContextFields,
          };
        },
      );

      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });
    });

    it("should return evaluated features", async () => {
      httpClient.post.mockClear(); // not interested in updates

      await client.initialize();
      const result = client.getFeatures({
        company,
        user,
        other: otherContext,
      });

      expect(result).toEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateTargeting).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
            targetingVersion: 1,
            evalContext: {
              company,
              user,
              other: otherContext,
            },
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: {
              company,
              user,
              other: otherContext,
            },
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["something"],
          },
          {
            type: "feature-flag-event",
            action: "check",
            key: "feature1",
            targetingVersion: 1,
            evalResult: true,
          },
        ],
      );
    });

    it("should properly define the rate limiter key", async () => {
      await client.initialize();
      client.getFeatures({ user, company, other: otherContext });

      expect(checkWithinAllottedTimeWindow).toHaveBeenCalledWith(
        FEATURE_EVENTS_PER_MIN,
        "evaluate:user.id=user123&user.age=1&user.name=John&company.id=company123&company.employees=100&company.name=Acme+Inc.&other.custom=context&other.key=value:feature1:1:true",
      );
    });

    it("should return evaluated features when only user is defined", async () => {
      httpClient.post.mockClear(); // not interested in updates

      await client.initialize();
      const features = client.getFeatures({ user });

      expect(features).toEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateTargeting).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
            targetingVersion: 1,
            evalContext: {
              user,
            },
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: {
              user,
            },
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["something"],
          },
          {
            action: "check",
            evalResult: true,
            key: "feature1",
            targetingVersion: 1,
            type: "feature-flag-event",
          },
        ],
      );
    });

    it("should return evaluated features when only company is defined", async () => {
      await client.initialize();
      const features = client.getFeatures({ company });
      expect(features).toEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateTargeting).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
            targetingVersion: 1,
            evalContext: {
              company,
            },
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: {
              company,
            },
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["something"],
          },
          {
            action: "check",
            evalResult: true,
            key: "feature1",
            targetingVersion: 1,
            type: "feature-flag-event",
          },
        ],
      );
    });

    it("should return evaluated features when only other context is defined", async () => {
      await client.initialize();
      client.getFeatures({ other: otherContext });

      await client.flush();

      expect(evaluateTargeting).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
            targetingVersion: 1,
            evalContext: {
              other: otherContext,
            },
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: {
              other: otherContext,
            },
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["something"],
          },
        ],
      );
    });

    it("should use fallback features when getFeatureDefinitions returns undefined", async () => {
      httpClient.get.mockResolvedValue({
        success: false,
      });

      await client.initialize();
      const result = client.getFeatures({});

      expect(result).toEqual({
        key: {
          key: "key",
          isEnabled: true,
          track: expect.any(Function),
        },
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          "failed to use feature definitions, there are none cached yet. Using fallback features.",
        ),
      );

      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "feature-flag-event",
            action: "check",
            key: "key",
            evalResult: true,
          },
        ],
      );
    });

    it("should not fail if sendFeatureEvent fails to send evaluate event", async () => {
      httpClient.post.mockRejectedValueOnce(new Error("Network error"));

      await client.initialize();
      const features = client.getFeatures({});

      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "bulk" failed with error'),
        expect.any(Error),
      );

      expect(features).toEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          track: expect.any(Function),
        },
      });
    });

    it("should not fail if sendFeatureEvent fails to send check event", async () => {
      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      await client.initialize();
      httpClient.post.mockRejectedValue(new Error("Network error"));

      const result = client.getFeatures({});

      // Trigger a feature check
      expect(result.feature1).toEqual({
        key: "feature1",
        isEnabled: true,
        track: expect.any(Function),
      });

      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching('post request to "bulk" failed with error'),
        expect.any(Error),
      );
    });
  });
});

describe("BoundBucketClient", () => {
  const httpClient = { post: vi.fn(), get: vi.fn() };

  beforeAll(() => {
    const response = {
      status: 200,
      body: { success: true },
    };
    httpClient.post.mockResolvedValue(response);
  });

  const client = new BucketClient({
    secretKey: "validSecretKeyWithMoreThan22Chars",
    httpClient,
  });

  it("should create a client instance", () => {
    expect(client).toBeInstanceOf(BucketClient);
  });

  it("should return a new client instance with merged attributes", () => {
    const userOverride = { sex: "male", age: 30 };
    const companyOverride = { employees: 200, bankrupt: false };
    const otherOverride = { key: "new-value" };
    const other = { key: "value" };
    const newClient = client
      .bindClient({
        user,
        company,
        other,
      })
      .bindClient({
        user: { id: user.id, ...userOverride },
        company: { id: company.id, ...companyOverride },
        other: otherOverride,
      });

    expect(newClient["_context"]).toEqual({
      user: { ...user, ...userOverride },
      company: { ...company, ...companyOverride },
      other: { ...other, ...otherOverride },
    });
  });

  it("should allow using expected methods", async () => {
    const boundClient = client.bindClient({ other: { key: "value" } });
    expect(boundClient.otherContext).toEqual({
      key: "value",
    });

    await client.initialize();
    boundClient.getFeatures();
  });

  it("should allow using expected methods when bound to user", async () => {
    const boundClient = client.bindClient({ user: { id: "user" } });
    expect(boundClient.user).toEqual({ id: "user" });

    expect(
      boundClient.bindClient({ other: { key: "value" } }).otherContext,
    ).toEqual({
      key: "value",
    });

    boundClient.getFeatures();
    await boundClient.track("feature");
  });
});
