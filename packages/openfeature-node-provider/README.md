# Bucket Node.js OpenFeature Provider

The official OpenFeature Node.js provider for [Bucket](https://bucket.co) feature management service.

## Installation

```shell
npm install @bucketco/openfeature-node-provider
```

### Required peer dependencies

The OpenFeature SDK is required as peer dependency.
The minimum required version of `@openfeature/server-sdk` currently is `1.13.5`.
The minimum required version of `@bucketco/node-sdk` currently is `2.0.0`.

```shell
npm install @openfeature/server-sdk @bucketco/node-sdk
```

## Usage

The provider uses the [Bucket Node.js SDK](https://docs.bucket.co/quickstart/supported-languages-frameworks/node.js-sdk).
The available options can be found in the [Bucket Node.js SDK](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/node-sdk#initialization-options).

### Example using the default configuration

```typescript
import { BucketNodeProvider } from "@bucketco/openfeature-node-provider";
import { OpenFeature } from "@openfeature/server-sdk";

const provider = new BucketNodeProvider({ secretKey });

await OpenFeature.setProviderAndWait(provider);

// set a value to the global context
OpenFeature.setContext({ region: "us-east-1" });

// set a value to the invocation context
// this is merged with the global context
const requestContext = {
  targetingKey: req.user.id,
  email: req.user.email,
  companyPlan: req.locals.plan,
};

const client = OpenFeature.getClient();

const enterpriseFeatureEnabled = await client.getBooleanValue(
  "enterpriseFeature",
  false,
  requestContext,
);
```

## Feature resolution methods

The Bucket OpenFeature Provider implements the OpenFeature evaluation interface for different value types. Each method handles the resolution of feature flags according to the OpenFeature specification.

### Common behavior

All resolution methods share these behaviors:

- Return default value with `PROVIDER_NOT_READY` if client is not initialized,
- Return default value with `FLAG_NOT_FOUND` if flag doesn't exist,
- Return default value with `ERROR` if there was a type mismatch,
- Return evaluated value with `TARGETING_MATCH` on successful resolution.

### Type-Specific Methods

#### Boolean Resolution

```ts
client.getBooleanValue("my-flag", false);
```

Returns the feature's enabled state. This is the most common use case for feature flags.

#### String Resolution

```ts
client.getStringValue("my-flag", "default");
```

Returns the feature's remote config key (also known as "variant"). Useful for multi-variate use cases.

#### Number Resolution

```ts
client.getNumberValue("my-flag", 0);
```

Not directly supported by Bucket. Use `getObjectValue` instead for numeric configurations.

#### Object Resolution

```ts
// works for any type:
client.getObjectValue("my-flag", { defaultValue: true });
client.getObjectValue("my-flag", "string-value");
client.getObjectValue("my-flag", 199);
```

Returns the feature's remote config payload with type validation. This is the most flexible method,
allowing for complex configuration objects or simple types.

The object resolution performs runtime type checking between the default value and the feature payload to ensure type safety.

## Translating Evaluation Context

Bucket uses a context object of the following shape:

```ts
/**
 * Describes the current user context, company context, and other context.
 * This is used to determine if feature targeting matches and to track events.
 **/
export type BucketContext = {
  /**
   * The user context. If the user is set, the user ID is required.
   */
  user?: {
    id: string;
    name?: string;
    email?: string;
    avatar?: string;
    [k: string]: any;
  };

  /**
   * The company context. If the company is set, the company ID is required.
   */
  company?: { id: string; name?: string; avatar?: string; [k: string]: any };

  /**
   * The other context. This is used for any additional context that is not related to user or company.
   */
  other?: Record<string, any>;
};
```

To use the Bucket Node.js OpenFeature provider, you must convert your OpenFeature contexts to Bucket contexts.
You can achieve this by supplying a context translation function which takes the Open Feature context and returns
a corresponding Bucket Context:

```ts
import { BucketNodeProvider } from "@openfeature/bucket-node-provider";

const contextTranslator = (context: EvaluationContext): BucketContext => {
  return {
    user: {
      id: context.targetingKey ?? context["userId"]?.toString(),
      name: context["name"]?.toString(),
      email: context["email"]?.toString(),
      avatar: context["avatar"]?.toString(),
      country: context["country"]?.toString(),
    },
    company: {
      id: context["companyId"]?.toString(),
      name: context["companyName"]?.toString(),
      avatar: context["companyAvatar"]?.toString(),
      plan: context["companyPlan"]?.toString(),
    },
  };
};

const provider = new BucketNodeProvider({ secretKey, contextTranslator });

OpenFeature.setProvider(provider);
```

## Tracking feature adoption

The Bucket OpenFeature provider supports the OpenFeature Tracking API.
It's straight forward to start sending tracking events through OpenFeature.

Simply call the "track" method on the OpenFeature client:

```typescript
import { BucketNodeProvider } from "@bucketco/openfeature-node-provider";
import { OpenFeature } from "@openfeature/server-sdk";

const provider = new BucketNodeProvider({ secretKey });

await OpenFeature.setProviderAndWait(provider);

const client = OpenFeature.getClient();

// `evaluationContext` is whatever you use to evaluate features based off
const enterpriseFeatureEnabled = await client.track(
  "huddles",
  evaluationContext,
);
```

## License

> MIT License
> Copyright (c) 2025 Bucket ApS
