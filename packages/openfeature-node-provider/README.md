# Bucket Node.js OpenFeature Provider

The official OpenFeature Node.js provider for [Bucket](https://bucket.co) feature management service.

## Installation

```
$ npm install @bucketco/openfeature-node-provider
```

#### Required peer dependencies

The OpenFeature SDK is required as peer dependency.

The minimum required version of `@openfeature/server-sdk` currently is `1.13.5`.

The minimum required version of `@bucketco/node-sdk` currently is `2.0.0`.

```
$ npm install @openfeature/server-sdk @bucketco/node-sdk
```

## Usage

The provider uses the [Bucket Node.js SDK](https://docs.bucket.co/quickstart/supported-languages-frameworks/node.js-sdk).

The available options can be found in the [Bucket Node.js SDK](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/node-sdk#initialization-options).

### Example using the default configuration

```javascript
import { BucketNodeProvider } from "@bucketco/openfeature-node-provider";

const provider = new BucketNodeProvider({ secretKey });

OpenFeature.setProvider(provider);

// set a value to the global context
OpenFeature.setContext({ region: "us-east-1" });

// set a value to the invocation context
// this is merged with the global context
const requestContext = {
  targetingKey: req.user.id,
  email: req.user.email,
  companyPlan: req.locals.plan,
};

const client = OpenFeature.getClient()

const enterpriseFeatureEnabled = await client.getBooleanValue(
  "enterpriseFeature",
  false,
  requestContext,
);
```

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
  user?: { id: string; [k: string]: any };
  /**
   * The company context. If the company is set, the company ID is required.
   */
  company?: { id: string; [k: string]: any };
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
      id: context.targetingKey,
      name: context["name"]?.toString(),
      email: context["email"]?.toString(),
      country: context["country"]?.toString(),
    },
    company: {
      id: context["companyId"],
      name: context["companyName"],
    },
  };
};

const provider = new BucketNodeProvider({ secretKey, contextTranslator });

OpenFeature.setProvider(provider);
```

## Building

Run `nx package providers-bucket-node` to build the library.

## Running unit tests

Run `nx test providers-bucket-node` to execute the unit tests via [Jest](https://jestjs.io).
