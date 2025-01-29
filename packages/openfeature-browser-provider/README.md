# Bucket Browser OpenFeature Provider

The official OpenFeature Browser provider for [Bucket](https://bucket.co) feature management service.

It uses the Bucket Browser SDK internally and thus allow you to collect [automated feedback surveys](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/browser-sdk#qualitative-feedback)
when people use your features as well as tracking which customers use which features.

If you're using React, you'll be better off with the [Bucket React SDK](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/react-sdk/README.md) or the [OpenFeature React SDK](https://openfeature.dev/docs/reference/technologies/client/web/react/).

See the `example` folder for how to use the OpenFeature React SDK with Next.js.

## Installation

The OpenFeature SDK is required as peer dependency.

The minimum required version of `@openfeature/web-sdk` currently is `1.0`.

```
$ npm install @openfeature/web-sdk @bucketco/openfeature-browser-provider
```

## Sample initialization

```ts
import { BucketBrowserProvider } from "@bucketco/openfeature-browser-provider";
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

Initializing the Bucket Browser Provider will
also initialize [automatic feedback surveys](https://github.com/bucketco/bucket-javascript-sdk/tree/main/packages/browser-sdk#qualitative-feedback).

## Context

To convert the OpenFeature context to a Bucket appropriate context
pass a translation function along to the `BucketBrowserProvider` constructor
like so:

```ts
import { BucketBrowserProvider } from "@bucketco/openfeature-browser-provider";
import { EvaluationContext, OpenFeature } from "@openfeature/web-sdk";

// initialize provider
const publishableKey = "<your-bucket-publishable-key>";

// this converts the context to a Bucket compatible context
// adapt it to fit your need
const contextTranslator = (context?: EvaluationContext) => {
  return {
    user: {
      id: context["trackingKey"],
      name: context["name"],
      email: context["email"],
    },
    company: { id: context["orgId"], name: context["orgName"] },
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

The Bucket OpenFeature Provider supports the OpenFeature tracking API
natively.

```ts
import { BucketBrowserProvider } from "@bucketco/openfeature-browser-provider";
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

# License

MIT License

Copyright (c) 2025 Bucket ApS
