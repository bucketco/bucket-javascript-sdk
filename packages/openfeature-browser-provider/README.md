# Bucket Browser OpenFeature Provider

The official OpenFeature Browser provider for [Bucket](https://bucket.co) feature management service.

It uses the Bucket Browser SDK internally and thus allow you to collect [automated feedback surveys](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/browser-sdk#qualitative-feedback)
when people use your features as well as tracking which customers use which features.

If you're using React, you'll be better off with the [Bucket React SDK](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/react-sdk/README.md) or the [OpenFeature React SDK](https://openfeature.dev/docs/reference/technologies/client/web/react/).

## Installation

```
$ npm install @bucketco/openfeature-browser-provider
```

## Sample initialization

```ts
import { BucketBrowserProvider } from "@bucketco/openfeature-browser-provider";

// initialize provider
const publishableKey = "<your-bucket-publishable-key>";

const bucketProvider = new BucketBrowserProvider({ publishableKey });

// set open feature provider and get client
OpenFeature.setProvider(bucketProvider);
const client = OpenFeature.getClient();

// use client
const boolValue = client.getBooleanValue("huddles", false);
```

Bucket only supports boolean values. Initializing the Bucket Browser Provider will
also intialize [automatic feedback surveys](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/browser-sdk#qualitative-feedback).

## Context

To convert the OpenFeature context to a Bucket appropriate context
pass a translation function along to the `BucketBrowserProvider` constructor
like so:

```ts
import { BucketBrowserProvider } from "@bucketco/openfeature-browser-provider";

// initialize provider
const publishableKey = "<your-bucket-publishable-key>";

const contextTranslator = (context?: EvaluationContext) => {
  return {
    user: { id: context.userId, name: context.name, email: context.email },
    company: { id: context.orgId, name: context.orgName },
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

# Tracking feature usage

To track feature usage, use the `track` method on the client.
By default you can use the flag/feature key to designate feature usage
when calling the `track` method:

```ts
OpenFeature.getClient().client.track("huddle", { voiceHuddle: true });
```

# License

MIT License

Copyright (c) 2024 Bucket ApS
