import flushPromises from "flush-promises";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  test,
  vi,
} from "vitest";

import { evaluateFeatureRules } from "@bucketco/flag-evaluation";

import { BoundBucketClient, BucketClient } from "../src";
import {
  API_BASE_URL,
  BATCH_INTERVAL_MS,
  BATCH_MAX_SIZE,
  FEATURE_EVENT_RATE_LIMITER_WINDOW_SIZE_MS,
  FEATURES_REFETCH_MS,
  SDK_VERSION,
  SDK_VERSION_HEADER_NAME,
} from "../src/config";
import fetchClient from "../src/fetch-http-client";
import { subscribe as triggerOnExit } from "../src/flusher";
import { newRateLimiter } from "../src/rate-limiter";
import { ClientOptions, Context, FeaturesAPIResponse } from "../src/types";

const BULK_ENDPOINT = "https://api.example.com/bulk";

vi.mock("@bucketco/flag-evaluation", async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    evaluateFeatureRules: vi.fn(),
  };
});

vi.mock("../src/rate-limiter", async (importOriginal) => {
  const original = (await importOriginal()) as any;

  return {
    ...original,
    newRateLimiter: vi.fn(original.newRateLimiter),
  };
});

vi.mock("../src/flusher", () => ({
  subscribe: vi.fn(),
}));

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

const event = {
  event: "feature-event",
  attrs: { key: "value" },
};

const otherContext = { custom: "context", key: "value" };
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
  apiBaseUrl: "https://api.example.com/",
  logger,
  httpClient,
  fallbackFeatures,
  batchOptions: {
    maxSize: 99,
    intervalMs: 100,
    flushOnExit: false,
  },
  offline: false,
};

const expectedHeaders = {
  [SDK_VERSION_HEADER_NAME]: SDK_VERSION,
  "Content-Type": "application/json",
  Authorization: `Bearer ${validOptions.secretKey}`,
};

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

describe("BucketClient", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with no options", async () => {
      const secretKeyEnv = process.env.BUCKET_SECRET_KEY;
      process.env.BUCKET_SECRET_KEY = "validSecretKeyWithMoreThan22Chars";
      try {
        const bucketInstance = new BucketClient();
        expect(bucketInstance).toBeInstanceOf(BucketClient);
      } finally {
        process.env.BUCKET_SECRET_KEY = secretKeyEnv;
      }
    });

    it("should create a client instance with valid options", () => {
      const client = new BucketClient(validOptions);

      expect(client).toBeInstanceOf(BucketClient);
      expect(client["_config"].apiBaseUrl).toBe("https://api.example.com/");
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

      expect(client["_config"].apiBaseUrl).toBe(API_BASE_URL);
      expect(client["_config"].refetchInterval).toBe(FEATURES_REFETCH_MS);
      expect(client["_config"].staleWarningInterval).toBe(
        FEATURES_REFETCH_MS * 5,
      );
      expect(client["_config"].httpClient).toBe(fetchClient);
      expect(client["_config"].headers).toEqual(expectedHeaders);
      expect(client["_config"].fallbackFeatures).toBeUndefined();
      expect(client["_config"].batchBuffer).toMatchObject({
        maxSize: BATCH_MAX_SIZE,
        intervalMs: BATCH_INTERVAL_MS,
      });
    });

    it("should throw an error if options are invalid", () => {
      let invalidOptions: any = null;
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "options must be an object",
      );

      invalidOptions = { ...validOptions, secretKey: "shortKey" };
      expect(() => new BucketClient(invalidOptions)).toThrow(
        "invalid secretKey specified",
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

    it("should create a new feature events rate-limiter", () => {
      const client = new BucketClient(validOptions);

      expect(client["_config"].rateLimiter).toBeDefined();
      expect(newRateLimiter).toHaveBeenCalledWith(
        FEATURE_EVENT_RATE_LIMITER_WINDOW_SIZE_MS,
      );
    });

    it("should not register an exit flush handler if `batchOptions.flushOnExit` is false", () => {
      new BucketClient({
        ...validOptions,
        batchOptions: { ...validOptions.batchOptions, flushOnExit: false },
      });

      expect(triggerOnExit).not.toHaveBeenCalled();
    });

    it("should not register an exit flush handler if `offline` is true", () => {
      new BucketClient({
        ...validOptions,
        offline: true,
      });

      expect(triggerOnExit).not.toHaveBeenCalled();
    });

    it.each([undefined, true])(
      "should register an exit flush handler if `batchOptions.flushOnExit` is `%s`",
      (flushOnExit) => {
        new BucketClient({
          ...validOptions,
          batchOptions: { ...validOptions.batchOptions, flushOnExit },
        });

        expect(triggerOnExit).toHaveBeenCalledWith(expect.any(Function));
      },
    );

    it.each([
      ["https://api.example.com", "https://api.example.com/bulk"],
      ["https://api.example.com/", "https://api.example.com/bulk"],
      ["https://api.example.com/path", "https://api.example.com/path/bulk"],
      ["https://api.example.com/path/", "https://api.example.com/path/bulk"],
    ])(
      "should build the URLs correctly %s -> %s",
      async (apiBaseUrl, expectedUrl) => {
        const client = new BucketClient({
          ...validOptions,
          apiBaseUrl,
        });

        await client.updateUser("user_id");
        await client.flush();

        expect(httpClient.post).toHaveBeenCalledWith(
          expectedUrl,
          expect.any(Object),
          expect.any(Object),
        );
      },
    );
  });

  describe("bindClient", () => {
    const client = new BucketClient(validOptions);
    const context = {
      user,
      company,
      other: otherContext,
    };

    beforeEach(() => {
      vi.mocked(httpClient.post).mockResolvedValue({ body: { success: true } });
      client["_config"].rateLimiter.clear(true);
    });

    it("should return a new client instance with the `user`, `company` and `other` set", async () => {
      const newClient = client.bindClient(context);
      await client.flush();

      expect(newClient.user).toEqual(user);
      expect(newClient.company).toEqual(company);
      expect(newClient.otherContext).toEqual(otherContext);

      expect(newClient).toBeInstanceOf(BoundBucketClient);
      expect(newClient).not.toBe(client); // Ensure a new instance is returned
      expect(newClient["_options"]).toEqual({
        enableTracking: true,
        ...context,
      });
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
            context: undefined,
          },
        ],
      );

      expect(httpClient.post).toHaveBeenCalledOnce();
    });

    it("should update company in Bucket when called", async () => {
      client.bindClient({ company: context.company, meta: { active: true } });
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
              active: true,
            },
          },
        ],
      );

      expect(httpClient.post).toHaveBeenCalledOnce();
    });

    it("should not update `company` or `user` in Bucket when `enableTracking` is `false`", async () => {
      client.bindClient({
        user: context.user,
        company: context.company,
        enableTracking: false,
      });

      await client.flush();

      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("should throw an error if `user` is invalid", () => {
      expect(() =>
        client.bindClient({ user: "bad_attributes" as any }),
      ).toThrow("validation failed: user must be an object if given");
      expect(() => client.bindClient({ user: { id: {} as any } })).toThrow(
        "validation failed: user.id must be a string or number if given",
      );
    });

    it("should throw an error if `company` is invalid", () => {
      expect(() =>
        client.bindClient({ company: "bad_attributes" as any }),
      ).toThrow("validation failed: company must be an object if given");
      expect(() => client.bindClient({ company: { id: {} as any } })).toThrow(
        "validation failed: company.id must be a string or number if given",
      );
    });

    it("should throw an error if `other` is invalid", () => {
      expect(() =>
        client.bindClient({ other: "bad_attributes" as any }),
      ).toThrow("validation failed: other must be an object");
    });

    it("should throw an error if `enableTracking` is invalid", () => {
      expect(() =>
        client.bindClient({ enableTracking: "bad_attributes" as any }),
      ).toThrow("validation failed: enableTracking must be a boolean");
    });

    it("should allow context without id", () => {
      const c = client.bindClient({
        user: { id: undefined, name: "userName" },
        company: { id: undefined, name: "companyName" },
      });
      expect(c.user?.id).toBeUndefined();
      expect(c.company?.id).toBeUndefined();
    });
  });

  describe("updateUser", () => {
    const client = new BucketClient(validOptions);

    beforeEach(() => {
      client["_config"].rateLimiter.clear(true);
    });

    // try with both string and number IDs
    test.each([
      { id: "user123", age: 1, name: "John" },
      { id: 42, age: 1, name: "John" },
    ])("should successfully update the user", async (testUser) => {
      const response = { status: 200, body: { success: true } };
      httpClient.post.mockResolvedValue(response);

      await client.updateUser(testUser.id, {
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
            userId: testUser.id,
            attributes: { age: 2, brave: false },
            context: { active: true },
          },
        ],
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching("post request to "),
        response,
      );
    });

    it("should log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      await client.updateUser(user.id);
      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching("post request to .* failed with error"),
        error,
      );
    });

    it("should log if API call returns false", async () => {
      const response = { status: 200, body: { success: false } };

      httpClient.post.mockResolvedValue(response);

      await client.updateUser(user.id);
      await client.flush();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching("invalid response received from server for"),
        response,
      );
    });

    it("should throw an error if opts are not valid or the user is not set", async () => {
      await expect(
        client.updateUser(user.id, "bad_opts" as any),
      ).rejects.toThrow("validation failed: options must be an object");

      await expect(
        client.updateUser(user.id, { attributes: "bad_attributes" as any }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.updateUser(user.id, { meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("updateCompany", () => {
    const client = new BucketClient(validOptions);

    beforeEach(() => {
      client["_config"].rateLimiter.clear(true);
    });

    test.each([
      {
        id: "company123",
        employees: 100,
        name: "Acme Inc.",
        userId: "user123",
      },
      { id: 42, employees: 100, name: "Acme Inc.", userId: 42 },
    ])(`should successfully update the company`, async (testCompany) => {
      const response = { status: 200, body: { success: true } };
      httpClient.post.mockResolvedValue(response);

      await client.updateCompany(testCompany.id, {
        attributes: { employees: 200, bankrupt: false },
        meta: { active: true },
        userId: testCompany.userId,
      });

      await client.flush();

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "company",
            companyId: testCompany.id,
            attributes: { employees: 200, bankrupt: false },
            context: { active: true },
            userId: testCompany.userId,
          },
        ],
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching("post request to .*"),
        response,
      );
    });

    it("should log an error if the post request throws", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      await client.updateCompany(company.id, {});
      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching("post request to .* failed with error"),
        error,
      );
    });

    it("should log an error if API responds with success: false", async () => {
      const response = {
        status: 200,
        body: { success: false },
      };

      httpClient.post.mockResolvedValue(response);

      await client.updateCompany(company.id, {});
      await client.flush();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching("invalid response received from server for"),
        response,
      );
    });

    it("should throw an error if company is not valid", async () => {
      await expect(
        client.updateCompany(company.id, "bad_opts" as any),
      ).rejects.toThrow("validation failed: options must be an object");

      await expect(
        client.updateCompany(company.id, {
          attributes: "bad_attributes" as any,
        }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        client.updateCompany(company.id, { meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("track", () => {
    const client = new BucketClient(validOptions);

    beforeEach(() => {
      client["_config"].rateLimiter.clear(true);
    });

    test.each([
      { id: "user123", age: 1, name: "John" },
      { id: 42, age: 1, name: "John" },
    ])("should successfully track the feature usage", async (testUser) => {
      const response = {
        status: 200,
        body: { success: true },
      };
      httpClient.post.mockResolvedValue(response);

      await client.bindClient({ user: testUser, company }).track(event.event, {
        attributes: event.attrs,
        meta: { active: true },
      });

      await client.flush();
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({
            type: "company",
          }),
          expect.objectContaining({
            type: "user",
          }),
          {
            attributes: {
              key: "value",
            },
            context: {
              active: true,
            },
            event: "feature-event",
            type: "event",
            userId: testUser.id,
            companyId: company.id,
          },
        ],
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringMatching("post request to"),
        response,
      );
    });

    it("should successfully track the feature usage including user and company", async () => {
      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });

      await client.bindClient({ user }).track(event.event, {
        companyId: "otherCompanyId",
        attributes: event.attrs,
        meta: { active: true },
      });

      await client.flush();
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({
            type: "user",
          }),
          {
            attributes: {
              key: "value",
            },
            context: {
              active: true,
            },
            event: "feature-event",
            companyId: "otherCompanyId",
            type: "event",
            userId: "user123",
          },
        ],
      );
    });

    it("should log an error if the post request fails", async () => {
      const error = new Error("Network error");
      httpClient.post.mockRejectedValue(error);

      await client.bindClient({ user }).track(event.event);
      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching("post request to .* failed with error"),
        error,
      );
    });

    it("should log if the API call returns false", async () => {
      const response = {
        status: 200,
        body: { success: false },
      };

      httpClient.post.mockResolvedValue(response);

      await client.bindClient({ user }).track(event.event);
      await client.flush();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching("invalid response received from server for "),
        response,
      );
    });

    it("should log if user is not set", async () => {
      const boundClient = client.bindClient({ company });

      await boundClient.track("hello");

      expect(httpClient.post).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching("no user set, cannot track event"),
      );
    });

    it("should throw an error if event is invalid", async () => {
      const boundClient = client.bindClient({ company, user });

      await expect(boundClient.track(undefined as any)).rejects.toThrow(
        "event must be a string",
      );
      await expect(boundClient.track(1 as any)).rejects.toThrow(
        "event must be a string",
      );

      await expect(
        boundClient.track(event.event, "bad_opts" as any),
      ).rejects.toThrow("validation failed: options must be an object");

      await expect(
        boundClient.track(event.event, {
          attributes: "bad_attributes" as any,
        }),
      ).rejects.toThrow("attributes must be an object");

      await expect(
        boundClient.track(event.event, { meta: "bad_meta" as any }),
      ).rejects.toThrow("meta must be an object");
    });
  });

  describe("user", () => {
    it("should return the undefined if user was not set", () => {
      const client = new BucketClient(validOptions).bindClient({ company });
      expect(client.user).toBeUndefined();
    });

    it("should return the user if user was associated", () => {
      const client = new BucketClient(validOptions).bindClient({ user });

      expect(client.user).toEqual(user);
    });
  });

  describe("company", () => {
    it("should return the undefined if company was not set", () => {
      const client = new BucketClient(validOptions).bindClient({ user });
      expect(client.company).toBeUndefined();
    });

    it("should return the user if company was associated", () => {
      const client = new BucketClient(validOptions).bindClient({ company });

      expect(client.company).toEqual(company);
    });
  });

  describe("otherContext", () => {
    it("should return the undefined if custom context was not set", () => {
      const client = new BucketClient(validOptions).bindClient({ company });
      expect(client.otherContext).toBeUndefined();
    });

    it("should return the user if custom context was associated", () => {
      const client = new BucketClient(validOptions).bindClient({
        other: otherContext,
      });

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
      await client.initialize();
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

  describe("flush", () => {
    it("should flush all bulk data", async () => {
      const client = new BucketClient(validOptions);

      await client.updateUser(user.id, { attributes: { age: 2 } });
      await client.updateUser(user.id, { attributes: { age: 3 } });
      await client.updateUser(user.id, { attributes: { name: "Jane" } });

      await client.flush();

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            type: "user",
            userId: user.id,
            attributes: { age: 2 },
          },
          {
            type: "user",
            userId: user.id,
            attributes: { age: 3 },
          },
          {
            type: "user",
            userId: user.id,
            attributes: { name: "Jane" },
          },
        ],
      );
    });

    it("should not flush all bulk data if `offline` is true", async () => {
      const client = new BucketClient({
        ...validOptions,
        offline: true,
      });

      await client.updateUser(user.id, { attributes: { age: 2 } });
      await client.flush();

      expect(httpClient.post).not.toHaveBeenCalled();
    });
  });

  describe("getFeature", () => {
    let client: BucketClient;
    beforeEach(async () => {
      httpClient.get.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          success: true,
          ...featureDefinitions,
        },
      });

      client = new BucketClient(validOptions);

      vi.mocked(evaluateFeatureRules).mockImplementation(
        ({ featureKey, context }) => {
          const evalFeature = evaluatedFeatures.find(
            (f) => f.feature.key === featureKey,
          )!;

          return {
            value: evalFeature.value,
            featureKey,
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

    it("returns a feature", async () => {
      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeature(
        {
          company,
          user,
          other: otherContext,
        },
        "feature1",
      );

      expect(feature).toEqual({
        key: "feature1",
        isEnabled: true,
        track: expect.any(Function),
      });
    });

    it("`track` sends all expected events when `enableTracking` is `true`", async () => {
      const context = {
        company,
        user,
        other: otherContext,
      };
      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeature(
        {
          ...context,
          meta: {
            active: true,
          },
          enableTracking: true,
        },
        "feature1",
      );
      await feature.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          {
            attributes: {
              employees: 100,
              name: "Acme Inc.",
            },
            companyId: "company123",
            context: {
              active: true,
            },
            type: "company",
          },
          {
            attributes: {
              age: 1,
              name: "John",
            },
            context: {
              active: true,
            },
            type: "user",
            userId: "user123",
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
            targetingVersion: 1,
            evalContext: context,
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: context,
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["something"],
          },
          {
            type: "event",
            event: "feature1",
            userId: user.id,
            companyId: company.id,
          },
        ],
      );
    });

    it("`isEnabled` sends `check` event", async () => {
      const context = {
        company,
        user,
        other: otherContext,
      };

      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeature(context, "feature1");

      // trigger `check` event
      expect(feature.isEnabled).toBe(true);

      await client.flush();

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({ type: "company" }),
          expect.objectContaining({ type: "user" }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
          }),
          {
            type: "feature-flag-event",
            action: "check",
            evalResult: true,
            targetingVersion: 1,
            key: "feature1",
          },
        ],
      );
    });

    it("everything works for unknown features", async () => {
      const context: Context = {
        company,
        user,
        other: otherContext,
      };
      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeature(context, "unknown-feature");

      // trigger `check` event
      expect(feature.isEnabled).toBe(false);
      await feature.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({
            type: "company",
          }),
          expect.objectContaining({
            type: "user",
          }),
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature1",
            targetingVersion: 1,
            evalContext: context,
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: context,
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["something"],
          },
          {
            type: "feature-flag-event",
            action: "check",
            evalResult: false,
            key: "unknown-feature",
          },
          {
            type: "event",
            event: "unknown-feature",
            userId: user.id,
            companyId: company.id,
          },
        ],
      );
    });
  });

  describe("getFeatures", () => {
    let client: BucketClient;

    beforeEach(async () => {
      httpClient.get.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          success: true,
          ...featureDefinitions,
        },
      });

      client = new BucketClient(validOptions);

      vi.mocked(evaluateFeatureRules).mockImplementation(
        ({ featureKey, context }) => {
          const evalFeature = evaluatedFeatures.find(
            (f) => f.feature.key === featureKey,
          )!;

          return {
            value: evalFeature.value,
            featureKey,
            context: context,
            ruleEvaluationResults: evalFeature.ruleEvaluationResults,
            missingContextFields: evalFeature.missingContextFields,
          };
        },
      );

      client["_config"].rateLimiter.clear(true);

      httpClient.post.mockResolvedValue({
        ok: true,
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
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({ type: "company" }),
          expect.objectContaining({ type: "user" }),
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
            action: "check",
            evalResult: false,
            key: "feature2",
            targetingVersion: 2,
            type: "feature-flag-event",
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

    it("should warn about missing context fields", async () => {
      httpClient.post.mockClear();

      await client.initialize();
      client.getFeatures({
        company,
        user,
        other: otherContext,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          'feature "feature2" has targeting rules that require the following context fields: "something"',
        ),
      );
    });

    it("should properly define the rate limiter key", async () => {
      const isAllowedSpy = vi.spyOn(client["_config"].rateLimiter, "isAllowed");

      await client.initialize();
      client.getFeatures({ user, company, other: otherContext });

      expect(isAllowedSpy).toHaveBeenCalledWith(
        "d461e93fe41f6297ab43402d0fc6d63e2444e07d",
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
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({ type: "user" }),
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
            evalResult: false,
            key: "feature2",
            targetingVersion: 2,
            type: "feature-flag-event",
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

      // expect will trigger the `isEnabled` getter and send a `check` event
      expect(features).toEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(2);
      expect(httpClient.post).toHaveBeenCalledTimes(1);

      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({ type: "company" }),
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
            evalResult: false,
            key: "feature2",
            targetingVersion: 2,
            type: "feature-flag-event",
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

    it("should not send flag events when `enableTracking` is `false`", async () => {
      await client.initialize();
      const features = client.getFeatures({ company, enableTracking: false });

      // expect will trigger the `isEnabled` getter and send a `check` event
      expect(features).toEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(2);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("should return evaluated features when only other context is defined", async () => {
      await client.initialize();
      client.getFeatures({ other: otherContext });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(2);
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

    it("should send `track` with user and company if provided", async () => {
      await client.initialize();
      const feature1 = client.getFeature({ company, user }, "feature1");

      await feature1.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({
            type: "company",
          }),
          expect.objectContaining({
            type: "user",
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
            evalContext: {
              company,
              user,
            },
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
          }),
          {
            companyId: "company123",
            event: "feature1",
            type: "event",
            userId: "user123",
          },
        ],
      );
    });

    it("should send `track` with user if provided", async () => {
      await client.initialize();
      const feature = client.getFeature({ user }, "feature1");

      await feature.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({
            type: "user",
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
            evalContext: {
              user,
            },
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
          }),
          {
            event: "feature1",
            type: "event",
            userId: "user123",
          },
        ],
      );
    });

    it("should not send `track` with only company if provided", async () => {
      // we do not accept track events without a userId
      await client.initialize();
      const feature = client.getFeature({ company }, "feature1");

      await feature.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({
            type: "company",
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
            evalContext: {
              company,
            },
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "evaluate",
          }),
        ],
      );
    });

    it("should use fallback features when `getFeatureDefinitions` returns `undefined`", async () => {
      httpClient.get.mockResolvedValue({
        success: false,
      });

      await client.initialize();
      const result = client.getFeature(
        { user: { id: "user123" }, enableTracking: true },
        "key",
      );

      expect(result).toEqual({
        key: "key",
        isEnabled: true,
        track: expect.any(Function),
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
          expect.objectContaining({ type: "user" }),
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
        expect.stringMatching("post request .* failed with error"),
        expect.any(Error),
      );

      expect(features).toEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
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
        expect.stringMatching("post request .* failed with error"),
        expect.any(Error),
      );
    });

    it("should use feature overrides", async () => {
      await client.initialize();
      const context = { user, company, other: otherContext };

      const pristineResults = client.getFeatures(context);
      expect(pristineResults).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      client.featureOverrides = (_context: Context) => {
        expect(context).toEqual(context);
        return {
          feature1: false,
          feature2: true,
        };
      };
      const features = client.getFeatures(context);

      expect(features).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: false,
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: true,
          track: expect.any(Function),
        },
      });
    });
  });

  describe("getFeaturesRemote", () => {
    let client: BucketClient;

    beforeEach(async () => {
      httpClient.get.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          success: true,
          remoteContextUsed: true,
          features: {
            feature1: {
              key: "feature1",
              targetingVersion: 1,
              isEnabled: true,
            },
            feature2: {
              key: "feature2",
              targetingVersion: 2,
              isEnabled: false,
              missingContextFields: ["something"],
            },
          },
        },
      });

      client = new BucketClient(validOptions);
    });

    afterEach(() => {
      httpClient.get.mockClear();
    });

    it("should return evaluated features", async () => {
      const result = await client.getFeaturesRemote("c1", "u1", {
        other: otherContext,
      });

      expect(result).toEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.other.custom=context&context.other.key=value&context.user.id=c1&context.company.id=u1",
        expectedHeaders,
      );
    });

    it("should not try to append the context if it's empty", async () => {
      await client.getFeaturesRemote();

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?",
        expectedHeaders,
      );
    });

    it("should warn if missing context fields", async () => {
      await client.getFeaturesRemote();
      expect(logger.warn).toHaveBeenCalledWith(
        'feature "feature2" has targeting rules that require the following context fields: "something"',
      );
    });
  });

  describe("getFeatureRemote", () => {
    let client: BucketClient;

    beforeEach(async () => {
      httpClient.get.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          success: true,
          remoteContextUsed: true,
          features: {
            feature1: {
              key: "feature1",
              targetingVersion: 1,
              isEnabled: true,
              missingContextFields: ["one", "two"],
            },
          },
        },
      });

      client = new BucketClient(validOptions);
    });

    afterEach(() => {
      httpClient.get.mockClear();
    });

    it("should return evaluated feature", async () => {
      const result = await client.getFeatureRemote("feature1", "c1", "u1", {
        other: otherContext,
      });

      expect(result).toEqual({
        key: "feature1",
        isEnabled: true,
        track: expect.any(Function),
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.other.custom=context&context.other.key=value&context.user.id=c1&context.company.id=u1&key=feature1",
        expectedHeaders,
      );
    });

    it("should not try to append the context if it's empty", async () => {
      await client.getFeatureRemote("feature1");

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?key=feature1",
        expectedHeaders,
      );
    });

    it("should warn if missing context fields", async () => {
      await client.getFeatureRemote("feature1");
      expect(logger.warn).toHaveBeenCalledWith(
        'feature "feature1" has targeting rules that require the following context fields: "one", "two"',
      );
    });
  });

  describe("offline mode", () => {
    let client: BucketClient;

    beforeEach(async () => {
      client = new BucketClient({
        ...validOptions,
        offline: true,
      });
      await client.initialize();
    });

    it("should send not send or fetch anything", async () => {
      client.getFeatures({});

      expect(httpClient.get).toHaveBeenCalledTimes(0);
      expect(httpClient.post).toHaveBeenCalledTimes(0);
    });
  });
});

describe("BoundBucketClient", () => {
  beforeAll(() => {
    const response = {
      status: 200,
      body: { success: true },
    };

    httpClient.post.mockResolvedValue(response);

    httpClient.get.mockResolvedValue({
      status: 200,
      body: {
        success: true,
        ...featureDefinitions,
      },
    });
  });
  const client = new BucketClient(validOptions);

  beforeEach(async () => {
    await flushPromises();
    await client.flush();

    vi.mocked(httpClient.post).mockClear();
    client["_config"].rateLimiter.clear(true);
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

    expect(newClient["_options"]).toEqual({
      user: { ...user, ...userOverride },
      company: { ...company, ...companyOverride },
      other: { ...other, ...otherOverride },
      enableTracking: true,
    });
  });

  it("should allow using expected methods when bound to user", async () => {
    const boundClient = client.bindClient({ user });
    expect(boundClient.user).toEqual(user);

    expect(
      boundClient.bindClient({ other: otherContext }).otherContext,
    ).toEqual(otherContext);

    boundClient.getFeatures();

    await boundClient.track("feature");
    await client.flush();

    expect(httpClient.post).toHaveBeenCalledWith(
      BULK_ENDPOINT,
      expectedHeaders,
      [
        expect.objectContaining({ type: "user" }),
        {
          event: "feature",
          type: "event",
          userId: "user123",
        },
      ],
    );
  });

  it("should add company ID from the context if not explicitly supplied", async () => {
    const boundClient = client.bindClient({ user, company });

    boundClient.getFeatures();
    await boundClient.track("feature");

    await client.flush();

    expect(httpClient.post).toHaveBeenCalledWith(
      BULK_ENDPOINT,
      expectedHeaders,
      [
        expect.objectContaining({ type: "company" }),
        expect.objectContaining({ type: "user" }),
        {
          companyId: "company123",
          event: "feature",
          type: "event",
          userId: "user123",
        },
      ],
    );
  });

  it("should disable tracking within the client if `enableTracking` is `false`", async () => {
    const boundClient = client.bindClient({
      user,
      company,
      enableTracking: false,
    });

    const { track } = boundClient.getFeature("feature2");
    await track();
    await boundClient.track("feature1");

    await client.flush();

    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("should allow using expected methods", async () => {
    const boundClient = client.bindClient({ other: { key: "value" } });
    expect(boundClient.otherContext).toEqual({
      key: "value",
    });

    await client.initialize();

    boundClient.getFeatures();
    boundClient.getFeature("feature1");

    await boundClient.flush();
  });

  describe("getFeatureRemote/getFeaturesRemote", () => {
    beforeEach(async () => {
      httpClient.get.mockClear();
      httpClient.get.mockResolvedValue({
        ok: true,
        status: 200,
        body: {
          success: true,
          remoteContextUsed: true,
          features: {
            feature1: {
              key: "feature1",
              targetingVersion: 1,
              isEnabled: true,
            },
            feature2: {
              key: "feature2",
              targetingVersion: 2,
              isEnabled: false,
              missingContextFields: ["something"],
            },
          },
        },
      });
    });

    it("should return evaluated features", async () => {
      const boundClient = client.bindClient({
        user,
        company,
        other: otherContext,
      });

      const result = await boundClient.getFeaturesRemote();

      expect(result).toEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          track: expect.any(Function),
        },
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.user.id=user123&context.user.age=1&context.user.name=John&context.company.id=company123&context.company.employees=100&context.company.name=Acme+Inc.&context.other.custom=context&context.other.key=value",
        expectedHeaders,
      );
    });

    it("should return evaluated feature", async () => {
      const boundClient = client.bindClient({
        user,
        company,
        other: otherContext,
      });

      const result = await boundClient.getFeatureRemote("feature1");

      expect(result).toEqual({
        key: "feature1",
        isEnabled: true,
        track: expect.any(Function),
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.user.id=user123&context.user.age=1&context.user.name=John&context.company.id=company123&context.company.employees=100&context.company.name=Acme+Inc.&context.other.custom=context&context.other.key=value&key=feature1",
        expectedHeaders,
      );
    });
  });
});
