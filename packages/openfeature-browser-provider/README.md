# Reflag Browser OpenFeature Provider

The official OpenFeature Browser provider for [Reflag](https://bucket.co) feature management service.

It uses the Reflag Browser SDK internally and thus allow you to collect [automated feedback surveys](https://github.com/reflagcom/javascript/tree/main/packages/browser-sdk#qualitative-feedback)
when people use your features as well as tracking which customers use which features.

If you're using React, you'll be better off with the [Reflag React SDK](https://github.com/reflagcom/javascript/blob/main/packages/react-sdk/README.md) or the [OpenFeature React SDK](https://openfeature.dev/docs/reference/technologies/client/web/react/).

See the `example` folder for how to use the OpenFeature React SDK with Next.js.

## Installation

The OpenFeature SDK is required as peer dependency.

The minimum required version of `@openfeature/web-sdk` currently is `1.0`.

```shell
npm install @openfeature/web-sdk @reflag/openfeature-browser-provider
```

## Sample initialization

```ts
import { BucketBrowserProvider } from "@reflag/openfeature-browser-provider";
import { OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-bucket-publishable-key>";

const bucketProvider = new BucketBrowserProvider({ publishableKey });

// set open feature provider and get client
await OpenFeature.setProviderAndWait(bucketProvider);
const client = OpenFeature.getClient();

// use client
const boolValue = client.getBooleanValue("huddles", false);

// use more complex, dynamic config-enabled functionality.
const feedbackConfig = client.getObjectValue("ask-feedback", {
  question: "How are you enjoying this feature?",
});
```

Initializing the Reflag Browser Provider will
also initialize [automatic feedback surveys](https://github.com/reflagcom/javascript/tree/main/packages/browser-sdk#qualitative-feedback).

## Feature resolution methods

The Reflag OpenFeature Provider implements the OpenFeature evaluation interface for different value types. Each method handles the resolution of flags according to the OpenFeature specification.

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

Returns the feature's enabled state. This is the most common use case for flags.

#### String Resolution

```ts
client.getStringValue("my-flag", "default");
```

Returns the feature's remote config key (also known as "variant"). Useful for multi-variate use cases.

#### Number Resolution

```ts
client.getNumberValue("my-flag", 0);
```

Not directly supported by Reflag. Use `getObjectValue` instead for numeric configurations.

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

## Context

To convert the OpenFeature context to a Reflag appropriate context
pass a translation function along to the `BucketBrowserProvider` constructor
like so:

```ts
import { BucketBrowserProvider } from "@reflag/openfeature-browser-provider";
import { EvaluationContext, OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-bucket-publishable-key>";

// this converts the context to a Reflag compatible context
// adapt it to fit your need
const contextTranslator = (context?: EvaluationContext) => {
  return {
    user: {
      id: context.targetingKey ?? context["userId"],
      email: context["email"]?.toString(),
      name: context["name"]?.toString(),
      avatar: context["avatar"]?.toString(),
      country: context["country"]?.toString(),
    },
    company: {
      id: context["companyId"],
      name: context["companyName"]?.toString(),
      avatar: context["companyAvatar"]?.toString(),
      plan: context["companyPlan"]?.toString(),
    },
  };
};

const bucketOpenFeatureProvider = new BucketBrowserProvider({
  publishableKey,
  contextTranslator,
});
```

To update the context, call `OpenFeature.setContext(myNewContext);`

```ts
await OpenFeature.setContext({ userId: "my-key" });
```

## Tracking feature usage

The Reflag OpenFeature Provider supports the OpenFeature tracking API
natively.

```ts
import { BucketBrowserProvider } from "@reflag/openfeature-browser-provider";
import { OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-bucket-publishable-key>";

const bucketProvider = new BucketBrowserProvider({ publishableKey });

// set OpenFeature provider and get client
await OpenFeature.setProviderAndWait(bucketProvider);
const client = OpenFeature.getClient();

// use client to send an event when user uses a feature
client.track("huddles");
```

## License

> MIT License
> Copyright (c) 2025 Bucket ApS
