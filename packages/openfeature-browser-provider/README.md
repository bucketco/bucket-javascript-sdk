# Reflag Browser OpenFeature Provider

The official OpenFeature Browser provider for [Reflag.com](https://bucket.co) flag management service.

It uses the Reflag Browser SDK internally and thus allow you to collect [automated feedback surveys](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/browser-sdk#qualitative-feedback)
when people use your flags as well as tracking which customers use which flags.

If you're using React, you'll be better off with the [Reflag React SDK](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/react-sdk/README.md) or the [OpenFeature React SDK](https://openfeature.dev/docs/reference/technologies/client/web/react/).

See the `example` folder for how to use the OpenFeature React SDK with Next.js.

## Installation

The OpenFeature SDK is required as peer dependency.

The minimum required version of `@openfeature/web-sdk` currently is `1.0`.

```shell
npm install @openfeature/web-sdk @reflag/openfeature-browser-provider
```

## Sample initialization

```ts
import { ReflagBrowserProvider } from "@reflag/openfeature-browser-provider";
import { OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-reflag-publishable-key>";

const reflagProvider = new ReflagBrowserProvider({ publishableKey });

// set OpenFeature provider and get client
await OpenFeature.setProviderAndWait(reflagProvider);
const client = OpenFeature.getClient();

// use client
const boolValue = client.getBooleanValue("huddles", false);

// use more complex, multi-variate flags.
const feedbackConfig = client.getObjectValue("ask-feedback", {
  question: "How are you enjoying this feature?",
});
```

Initializing the Reflag Browser Provider will
also initialize [automatic feedback surveys](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/browser-sdk#qualitative-feedback).

## Flag resolution methods

The Reflag OpenFeature Provider implements the OpenFeature evaluation interface for different value types. Each method handles the resolution of
flags according to the OpenFeature specification.

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

Returns the flags's value when the flag is expected to be a simple boolean toggle. Will fail for multi-variate flags.

#### String Resolution

```ts
client.getStringValue("my-flag", "default");
```

Returns the flag's variant key when the flag is multi-variate. Will fail for toggle flags.

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

Returns the flags's variant payload with type validation. This is the most flexible method,
allowing for complex configuration objects or simple types.

The object resolution performs runtime type checking between the default value and the flag payload to ensure type safety.

Will fail for toggle flags.

## Context

To convert the OpenFeature context to a Reflag appropriate context
pass a translation function along to the `ReflagBrowserProvider` constructor
like so:

```ts
import { ReflagBrowserProvider } from "@reflag/openfeature-browser-provider";
import { EvaluationContext, OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-reflag-publishable-key>";

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

const reflagOpenFeatureProvider = new ReflagBrowserProvider({
  publishableKey,
  contextTranslator,
});
```

To update the context, call `OpenFeature.setContext(myNewContext);`

```ts
await OpenFeature.setContext({ userId: "my-key" });
```

## Tracking flag usage

The Reflag OpenFeature Provider supports the OpenFeature tracking API
natively.

```ts
import { ReflagBrowserProvider } from "@reflag/openfeature-browser-provider";
import { OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-reflag-publishable-key>";

const reflagProvider = new ReflagBrowserProvider({ publishableKey });

// set OpenFeature provider and get client
await OpenFeature.setProviderAndWait(reflagProvider);
const client = OpenFeature.getClient();

// use client to send an event when user uses a feature
client.track("huddles");
```

## License

> MIT License
> Copyright (c) 2025 Bucket ApS
