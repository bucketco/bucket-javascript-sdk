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

import { evaluateFeatureRules, flattenJSON } from "@bucketco/flag-evaluation";

import { BoundBucketClient, BucketClient } from "../src";
import {
  API_BASE_URL,
  API_TIMEOUT_MS,
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
    evaluateFeatureRules: vi.fn(original.evaluateFeatureRules),
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
  featuresFetchRetries: 2,
  batchOptions: {
    maxSize: 99,
    intervalMs: 10001,
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
      description: "Feature 1",
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
      config: {
        version: 1,
        variants: [
          {
            filter: {
              type: "context",
              field: "company.id",
              operator: "IS",
              values: ["company123"],
            },
            key: "config-1",
            payload: { something: "else" },
          },
        ],
      },
    },
    {
      key: "feature2",
      description: "Feature 2",
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

    it("should accept fallback features as an array", async () => {
      const bucketInstance = new BucketClient({
        secretKey: "validSecretKeyWithMoreThan22Chars",
        fallbackFeatures: ["feature1", "feature2"],
      });

      expect(bucketInstance["_config"].fallbackFeatures).toEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
        },
        feature2: {
          isEnabled: true,
          key: "feature2",
        },
      });
    });

    it("should accept fallback features as an object", async () => {
      const bucketInstance = new BucketClient({
        secretKey: "validSecretKeyWithMoreThan22Chars",
        fallbackFeatures: {
          feature1: true,
          feature2: {
            isEnabled: true,
            config: {
              key: "config1",
              payload: { value: true },
            },
          },
        },
      });

      expect(bucketInstance["_config"].fallbackFeatures).toStrictEqual({
        feature1: {
          key: "feature1",
          config: undefined,
          isEnabled: true,
        },
        feature2: {
          key: "feature2",
          isEnabled: true,
          config: {
            key: "config1",
            payload: { value: true },
          },
        },
      });
    });

    it("should create a client instance with valid options", () => {
      const client = new BucketClient(validOptions);

      expect(client).toBeInstanceOf(BucketClient);
      expect(client["_config"].apiBaseUrl).toBe("https://api.example.com/");
      expect(client["_config"].refetchInterval).toBe(FEATURES_REFETCH_MS);
      expect(client["_config"].staleWarningInterval).toBe(
        FEATURES_REFETCH_MS * 5,
      );
      expect(client.logger).toBeDefined();
      expect(client.httpClient).toBe(validOptions.httpClient);
      expect(client["_config"].headers).toEqual(expectedHeaders);
      expect(client["batchBuffer"]).toMatchObject({
        maxSize: 99,
        intervalMs: 10001,
      });

      expect(client["_config"].fallbackFeatures).toEqual({
        key: {
          key: "key",
          isEnabled: true,
        },
      });
      expect(client["_config"].featuresFetchRetries).toBe(2);
    });

    it("should route messages to the supplied logger", () => {
      const client = new BucketClient(validOptions);

      const actualLogger = client.logger!;
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
      expect(client.httpClient).toBe(fetchClient);
      expect(client["_config"].headers).toEqual(expectedHeaders);
      expect(client["_config"].fallbackFeatures).toBeUndefined();
      expect(client["batchBuffer"]).toMatchObject({
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
        "fallbackFeatures must be an array or object",
      );
    });

    it("should create a new feature events rate-limiter", () => {
      const client = new BucketClient(validOptions);

      expect(client["rateLimiter"]).toBeDefined();
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
      client["rateLimiter"].clear(true);
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
      client["rateLimiter"].clear(true);
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
        JSON.stringify(response),
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
      client["rateLimiter"].clear(true);
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
        JSON.stringify(response),
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
      client["rateLimiter"].clear(true);
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
        JSON.stringify(response),
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

      const get = vi
        .spyOn(client["featuresCache"], "get")
        .mockReturnValue(undefined);
      const refresh = vi
        .spyOn(client["featuresCache"], "refresh")
        .mockResolvedValue(undefined);

      await client.initialize();
      await client.initialize();
      await client.initialize();

      expect(refresh).toHaveBeenCalledTimes(1);
      expect(get).not.toHaveBeenCalled();
    });

    it("should call the backend to obtain features", async () => {
      const client = new BucketClient(validOptions);

      httpClient.get.mockResolvedValue({
        ok: true,
        status: 200,
      });

      await client.initialize();

      expect(httpClient.get).toHaveBeenCalledWith(
        `https://api.example.com/features`,
        expectedHeaders,
        API_TIMEOUT_MS,
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

      httpClient.post.mockResolvedValue({
        status: 200,
        body: { success: true },
      });
    });

    it("returns a feature", async () => {
      await client.initialize();
      const feature = client.getFeature(
        {
          company,
          user,
          other: otherContext,
        },
        "feature1",
      );

      expect(feature).toStrictEqual({
        key: "feature1",
        isEnabled: true,
        config: {
          key: "config-1",
          payload: { something: "else" },
        },
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
            evalContext: flattenJSON(context),
            evalResult: true,
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate-config",
            key: "feature1",
            targetingVersion: 1,
            evalContext: flattenJSON(context),
            evalResult: {
              key: "config-1",
              payload: {
                something: "else",
              },
            },
            evalRuleResults: [true],
            evalMissingFields: [],
          },
          {
            type: "feature-flag-event",
            action: "evaluate",
            key: "feature2",
            targetingVersion: 2,
            evalContext: flattenJSON(context),
            evalResult: false,
            evalRuleResults: [false],
            evalMissingFields: ["attributeKey"],
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
      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter((e) => e.action === "check");

      expect(checkEvents).toStrictEqual([
        {
          type: "feature-flag-event",
          action: "check",
          key: "feature1",
          targetingVersion: 1,
          evalResult: true,
          evalContext: context,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      ]);
    });

    it("`config` sends `check` event", async () => {
      const context = {
        company,
        user,
        other: otherContext,
      };

      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeature(context, "feature1");

      // trigger `check` event
      expect(feature.config).toBeDefined();

      await client.flush();

      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter((e) => e.action === "check-config");

      expect(checkEvents).toStrictEqual([
        {
          type: "feature-flag-event",
          action: "check-config",
          key: "feature1",
          evalResult: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          targetingVersion: 1,
          evalContext: context,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      ]);
    });

    it("sends events for unknown features", async () => {
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

      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter((e) => e.type === "feature-flag-event");

      expect(checkEvents).toStrictEqual([
        expect.objectContaining({
          type: "feature-flag-event",
          action: "evaluate",
          key: "feature1",
        }),
        expect.objectContaining({
          type: "feature-flag-event",
          action: "evaluate-config",
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
          key: "unknown-feature",
          targetingVersion: undefined,
          evalContext: context,
          evalResult: false,
          evalRuleResults: undefined,
          evalMissingFields: undefined,
        },
      ]);
    });

    it("sends company/user and track events", async () => {
      const context: Context = {
        company,
        user,
        other: otherContext,
      };

      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeature(context, "feature1");

      // trigger `check` event
      await feature.track();
      await client.flush();

      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter(
          (e) =>
            e.type === "company" || e.type === "user" || e.type === "event",
        );

      expect(checkEvents).toStrictEqual([
        {
          type: "company",
          companyId: "company123",
          attributes: {
            employees: 100,
            name: "Acme Inc.",
          },
          userId: undefined, // this is a bug, will fix in separate PR
          context: undefined,
        },
        {
          type: "user",
          userId: "user123",
          attributes: {
            age: 1,
            name: "John",
          },
          context: undefined,
        },
        {
          type: "event",
          event: "feature1",
          userId: user.id,
          companyId: company.id,
          context: undefined,
          attributes: undefined,
        },
      ]);
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

      client["rateLimiter"].clear(true);

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

      expect(result).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          config: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(3);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
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
        "feature/remote config targeting rules might not be correctly evaluated due to missing context fields.",
        {
          feature2: ["attributeKey"],
        },
      );
    });

    it("should properly define the rate limiter key", async () => {
      const isAllowedSpy = vi.spyOn(client["rateLimiter"], "isAllowed");

      await client.initialize();
      client.getFeatures({ user, company, other: otherContext });

      expect(isAllowedSpy).toHaveBeenCalledWith("1GHpP+QfYperQ0AtD8bWPiRE4H0=");
    });

    it("should return evaluated features when only user is defined", async () => {
      httpClient.post.mockClear(); // not interested in updates

      await client.initialize();
      const features = client.getFeatures({ user });

      expect(features).toStrictEqual({
        feature1: {
          isEnabled: false,
          key: "feature1",
          config: {
            key: undefined,
            payload: undefined,
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(3);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it("should return evaluated features when only company is defined", async () => {
      await client.initialize();
      const features = client.getFeatures({ company });

      // expect will trigger the `isEnabled` getter and send a `check` event
      expect(features).toStrictEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
          config: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(3);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it("should not send flag events when `enableTracking` is `false`", async () => {
      await client.initialize();
      const features = client.getFeatures({ company, enableTracking: false });

      // expect will trigger the `isEnabled` getter and send a `check` event
      expect(features).toStrictEqual({
        feature1: {
          isEnabled: true,
          key: "feature1",
          config: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(3);
      expect(httpClient.post).not.toHaveBeenCalled();
    });

    it("should return evaluated features when only other context is defined", async () => {
      await client.initialize();
      const features = client.getFeatures({ other: otherContext });

      expect(features).toStrictEqual({
        feature1: {
          isEnabled: false,
          key: "feature1",
          config: {
            key: undefined,
            payload: undefined,
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      await client.flush();

      expect(evaluateFeatureRules).toHaveBeenCalledTimes(3);
      expect(httpClient.post).toHaveBeenCalledTimes(1);
    });

    it("should send `track` with user and company if provided", async () => {
      await client.initialize();
      const features = client.getFeatures({ company, user });
      await client.flush();

      await features.feature1.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(2);
      // second call includes the track event
      const events = httpClient.post.mock.calls[1][2].filter(
        (e: any) => e.type === "event",
      );

      expect(events).toStrictEqual([
        {
          event: "feature1",
          type: "event",
          userId: "user123",
          companyId: "company123",
          attributes: undefined,
          context: undefined,
        },
      ]);
    });

    it("should send `track` with user if provided", async () => {
      await client.initialize();
      const features = client.getFeatures({ user });

      await client.flush();
      await features.feature1.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(2);

      const emptyEvents = httpClient.post.mock.calls[0][2].filter(
        (e: any) => e.type === "event",
      );

      expect(emptyEvents).toStrictEqual([]);

      // second call includes the track event
      const events = httpClient.post.mock.calls[1][2].filter(
        (e: any) => e.type === "event",
      );

      expect(events).toStrictEqual([
        {
          event: "feature1",
          type: "event",
          userId: "user123",
          companyId: undefined,
          attributes: undefined,
          context: undefined,
        },
      ]);
    });

    it("should not send `track` with only company if no user is provided", async () => {
      // we do not accept track events without a userId
      await client.initialize();
      const feature = client.getFeatures({ company });

      await feature.feature1.track();
      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      const events = httpClient.post.mock.calls[0][2].filter(
        (e: any) => e.type === "event",
      );

      expect(events).toStrictEqual([]);
    });

    it("`isEnabled` sends `check` event", async () => {
      const context = {
        company,
        user,
        other: otherContext,
      };

      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeatures(context);

      // trigger `check` event
      expect(feature.feature1.isEnabled).toBe(true);

      await client.flush();
      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter((e) => e.action === "check");

      expect(checkEvents).toStrictEqual([
        {
          type: "feature-flag-event",
          action: "check",
          key: "feature1",
          targetingVersion: 1,
          evalResult: true,
          evalContext: context,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      ]);
    });

    it("`config` sends `check` event", async () => {
      const context = {
        company,
        user,
        other: otherContext,
      };

      // test that the feature is returned
      await client.initialize();
      const feature = client.getFeatures(context);

      // trigger `check` event
      expect(feature.feature1.config).toBeDefined();

      await client.flush();

      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter((e) => e.action === "check-config");

      expect(checkEvents).toStrictEqual([
        {
          type: "feature-flag-event",
          action: "check-config",
          key: "feature1",
          evalResult: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          targetingVersion: 1,
          evalContext: context,
          evalRuleResults: [true],
          evalMissingFields: [],
        },
      ]);
    });

    it("sends company/user events", async () => {
      const context: Context = {
        company,
        user,
        other: otherContext,
      };

      // test that the feature is returned
      await client.initialize();
      client.getFeatures(context);

      // trigger `check` event
      await client.flush();

      const checkEvents = httpClient.post.mock.calls
        .flatMap((call) => call[2])
        .filter(
          (e) =>
            e.type === "company" || e.type === "user" || e.type === "event",
        );

      expect(checkEvents).toStrictEqual([
        {
          type: "company",
          companyId: "company123",
          attributes: {
            employees: 100,
            name: "Acme Inc.",
          },
          userId: undefined, // this is a bug, will fix in separate PR
          context: undefined,
        },
        {
          type: "user",
          userId: "user123",
          attributes: {
            age: 1,
            name: "John",
          },
          context: undefined,
        },
      ]);
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

      expect(result).toStrictEqual({
        key: "key",
        isEnabled: true,
        config: { key: undefined, payload: undefined },
        track: expect.any(Function),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          "no feature definitions available, using fallback features",
        ),
      );

      await client.flush();

      expect(httpClient.post).toHaveBeenCalledTimes(1);
      expect(httpClient.post).toHaveBeenCalledWith(
        BULK_ENDPOINT,
        expectedHeaders,
        [
          expect.objectContaining({ type: "user" }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "check-config",
            key: "key",
          }),
          expect.objectContaining({
            type: "feature-flag-event",
            action: "check",
            key: "key",
            evalResult: true,
          }),
        ],
      );
    });

    it("should not fail if sendFeatureEvent fails to send evaluate event", async () => {
      httpClient.post.mockRejectedValueOnce(new Error("Network error"));
      const context = { user, company, other: otherContext };

      await client.initialize();
      const features = client.getFeatures(context);

      await client.flush();

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching("post request .* failed with error"),
        expect.any(Error),
      );

      expect(features).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          config: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
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
      const context = { user, company, other: otherContext };

      const result = client.getFeatures(context);

      // Trigger a feature check
      expect(result.feature1).toStrictEqual({
        key: "feature1",
        isEnabled: true,
        track: expect.any(Function),
        config: {
          key: "config-1",
          payload: {
            something: "else",
          },
        },
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
          config: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      client.featureOverrides = {
        feature1: false,
      };
      const features = client.getFeatures(context);

      expect(features).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      client.clearFeatureOverrides();
      const features2 = client.getFeatures(context);

      expect(features2).toStrictEqual({
        ...pristineResults,
        feature1: {
          ...pristineResults.feature1,
          track: expect.any(Function),
        },
        feature2: {
          ...pristineResults.feature2,
          track: expect.any(Function),
        },
      });
    });

    it("should use feature overrides from function", async () => {
      await client.initialize();
      const context = { user, company, other: otherContext };

      const pristineResults = client.getFeatures(context);
      expect(pristineResults).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          config: {
            key: "config-1",
            payload: {
              something: "else",
            },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      client.featureOverrides = (_context: Context) => {
        expect(context).toStrictEqual(context);
        return {
          feature1: { isEnabled: false },
          feature2: true,
          feature3: {
            isEnabled: true,
            config: {
              key: "config-1",
              payload: { something: "else" },
            },
          },
        };
      };
      const features = client.getFeatures(context);

      expect(features).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: true,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
        feature3: {
          key: "feature3",
          isEnabled: true,
          config: {
            key: "config-1",
            payload: { something: "else" },
          },
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
              config: {
                key: "config-1",
                version: 3,
                default: true,
                payload: { something: "else" },
                missingContextFields: ["funny"],
              },
              missingContextFields: ["something", "funny"],
            },
            feature2: {
              key: "feature2",
              targetingVersion: 2,
              isEnabled: false,
              missingContextFields: ["another"],
            },
            feature3: {
              key: "feature3",
              targetingVersion: 5,
              isEnabled: true,
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

      expect(result).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          config: {
            key: "config-1",
            payload: { something: "else" },
          },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
        feature3: {
          key: "feature3",
          isEnabled: true,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.other.custom=context&context.other.key=value&context.user.id=c1&context.company.id=u1",
        expectedHeaders,
        API_TIMEOUT_MS,
      );
    });

    it("should not try to append the context if it's empty", async () => {
      await client.getFeaturesRemote();

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?",
        expectedHeaders,
        API_TIMEOUT_MS,
      );
    });

    it("should warn if missing context fields", async () => {
      await client.getFeaturesRemote();
      expect(logger.warn).toHaveBeenCalledWith(
        "feature/remote config targeting rules might not be correctly evaluated due to missing context fields.",
        {
          feature1: ["something", "funny"],
          "feature1.config": ["funny"],
          feature2: ["another"],
        },
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
              config: {
                key: "config-1",
                version: 3,
                default: true,
                payload: { something: "else" },
                missingContextFields: ["two"],
              },
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

      expect(result).toStrictEqual({
        key: "feature1",
        isEnabled: true,
        track: expect.any(Function),
        config: {
          key: "config-1",
          payload: { something: "else" },
        },
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.other.custom=context&context.other.key=value&context.user.id=c1&context.company.id=u1&key=feature1",
        expectedHeaders,
        API_TIMEOUT_MS,
      );
    });

    it("should not try to append the context if it's empty", async () => {
      await client.getFeatureRemote("feature1");

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?key=feature1",
        expectedHeaders,
        API_TIMEOUT_MS,
      );
    });

    it("should warn if missing context fields", async () => {
      await client.getFeatureRemote("feature1");
      expect(logger.warn).toHaveBeenCalledWith(
        "feature/remote config targeting rules might not be correctly evaluated due to missing context fields.",
        {
          feature1: ["one", "two"],
          "feature1.config": ["two"],
        },
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
    client["rateLimiter"].clear(true);
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
              config: {
                key: "config-1",
                version: 3,
                default: true,
                payload: { something: "else" },
                missingContextFields: ["else"],
              },
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

      expect(result).toStrictEqual({
        feature1: {
          key: "feature1",
          isEnabled: true,
          config: { key: "config-1", payload: { something: "else" } },
          track: expect.any(Function),
        },
        feature2: {
          key: "feature2",
          isEnabled: false,
          config: { key: undefined, payload: undefined },
          track: expect.any(Function),
        },
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.user.id=user123&context.user.age=1&context.user.name=John&context.company.id=company123&context.company.employees=100&context.company.name=Acme+Inc.&context.other.custom=context&context.other.key=value",
        expectedHeaders,
        API_TIMEOUT_MS,
      );
    });

    it("should return evaluated feature", async () => {
      const boundClient = client.bindClient({
        user,
        company,
        other: otherContext,
      });

      const result = await boundClient.getFeatureRemote("feature1");

      expect(result).toStrictEqual({
        key: "feature1",
        isEnabled: true,
        config: { key: "config-1", payload: { something: "else" } },
        track: expect.any(Function),
      });

      expect(httpClient.get).toHaveBeenCalledTimes(1);

      expect(httpClient.get).toHaveBeenCalledWith(
        "https://api.example.com/features/evaluated?context.user.id=user123&context.user.age=1&context.user.name=John&context.company.id=company123&context.company.employees=100&context.company.name=Acme+Inc.&context.other.custom=context&context.other.key=value&key=feature1",
        expectedHeaders,
        API_TIMEOUT_MS,
      );
    });
  });
});
