# Bucket Node.js SDK

Node.js, JavaScriptS/Typescript feature flag and tracking client for [Bucket.co](https://bucket.co).

## Installation

Install using `yarn` or `npm` with:

> `yarn add -s @bucketco/node-sdk` or `npm install -s @bucketco/node-sdk`.

Other supported languages/frameworks are in the
[Supported languages](https://docs.bucket.co/quickstart/supported-languages)
documentation pages.

You can also [use the HTTP API directly](https://docs.bucket.co/reference/http-tracking-api)

## Basic usage

To get started you need to obtain a secret key from
[Environment setting view](https://app.bucket.co/envs/{environment}/settings/app-environments)
in **Bucket.co**.

> [!CAUTION]
> Secret keys are meant for use in server side SDKs only.
> Secret keys offer the users the ability to obtain
> information that is often sensitive and thus should not be used in
> client-side applications.

Create a `bucket.ts` file containing the following and set up the
BUCKET_SECRET_KEY environment variable:

```typescript
import { BucketClient } from "@bucketco/node-sdk";

// Create a new instance of the client with the secret key. Additional options
// are available, such as supplying a logger and other custom properties.
//
// We recommend that only one global instance of `client` should be created
// to avoid multiple round-trips to our servers.
export const bucketClient = new BucketClient();

// Initialize the client and begin fetching feature targeting definitions.
// You must call this method prior to any calls to `getFeatures()`,
// otherwise an empty object will be returned.
client.initialize().then({
  console.log("Bucket initialized!")
})
```

Once the client is initialized, you can obtain features along with the `isEnabled`
status to indicate whether the feature is targeted for this user/company:

```typescript
// configure the client
const boundClient = client.bindClient({
  user: { id: "john_doe", name: "John Doe" },
  company: { id: "acme_inc", name: "Acme, Inc." },
});

// get the huddle feature using company, user and custom context to
// evaluate the targeting.
const { isEnabled, track } = boundClient.getFeature("huddle");

if (isEnabled) {
  // this is your feature gated code ...
  // send an event when the feature is used:
  track();

  // CAUTION: if you plan to use the event for automated feedback surveys
  // call `flush` immediately after `track`. It can optionally be awaited
  // to guarantee the sent happened.
  boundClient.flush();
}
```

You can also use the `getFeatures` method which returns a map of all features:

```typescript
// get the current features (uses company, user and custom context to
// evaluate the features).
const features = boundClient.getFeatures();
const bothEnabled =
  features.huddle?.isEnabled && features.voiceHuddle?.isEnabled;
```

When using `getFeatures` be careful not to assume that a feature exists, this could
be a dangerous pattern:

```ts
// warning: if the `huddle` feature does not exist because it wasn't created in Bucket
// or because the client was unable to reach our servers for some reason, this will
// cause an exception:
const { isEnabled } = boundClient.getFeatures()["huddle"];
```

## Opting out of tracking

There are use cases in which one does not want to be sending `user`, `company` and
`track` events to Bucket.co. These are usually cases where one is impersonating
another user in the system and does not want to interfere with the data being
collected by Bucket.

To disable tracking, bind the client using `bindClient()` as follows:

```typescript
// bind the client to a given user and company and set `enableTracking` to `false`.
const boundClient = client.bindClient({ user, company, enableTracking: false });

boundClient.track("some event"); // this will not actually send the event to Bucket.

// the following code will not update the `user` nor `company` in Bucket and will
// not send `track` events either.
const { isEnabled, track } = boundClient.getFeature("user-menu");
if (isEnabled) {
  track();
}
```

Another way way to disable tracking without employing a bound client is to call `getFeature()`
or `getFeatures()` by supplying `enableTracking: false` in the context passed to
these functions.

> [!NOTE]
> Note, however, that calling `track`, `updateCompany` or `updateUser` in the `BucketClient`
> will still send tracking data. As such, it is always recommended to use `bindClient`
> when using this SDK.

## High performance feature targeting

The Bucket Node SDK contacts the Bucket servers when you call `initialize`
and downloads the features with their targeting rules.
These rules are then matched against the user/company information you provide
to `getFeatures` (or through `bindClient(..).getFeatures()`). That means the
`getFeatures` call does not need to contact the Bucket servers once initialize
has completed. `BucketClient` will continue to periodically download the
targeting rules from the Bucket servers in the background.

## Configuring

The Bucket `Node.js` SDK can be configured through environment variables or a
configuration file on disk. By default, the SDK searches for `bucketConfig.json`
in the current working directory.

| Option             | Type                    | Description                                                                                                                                                         | Env Var                                           |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `secretKey`        | string                  | The secret key used for authentication with Bucket's servers.                                                                                                       | BUCKET_SECRET_KEY                                 |
| `logLevel`         | string                  | The log level for the SDK (e.g., `"DEBUG"`, `"INFO"`, `"WARN"`, `"ERROR"`). Default: `INFO`                                                                         | BUCKET_LOG_LEVEL                                  |
| `offline`          | boolean                 | Operate in offline mode. Default: `false`, except in tests it will default to `true` based off of the `TEST` env. var.                                              | BUCKET_OFFLINE                                    |
| `host`             | string                  | The host URL for the Bucket servers.                                                                                                                                | BUCKET_HOST                                       |
| `featureOverrides` | Record<string, boolean> | An object specifying feature overrides for testing or local development. See [example/app.test.ts](example/app.test.ts) for how to use `featureOverrides` in tests. | BUCKET_FEATURES_ENABLED, BUCKET_FEATURES_DISABLED |
| `configFile`       | string                  | Load this config file from disk. Default: `bucketConfig.json`                                                                                                       | BUCKET_CONFIG_FILE                                |

Note: BUCKET_FEATURES_ENABLED, BUCKET_FEATURES_DISABLED are comma separated lists of features which will be enabled or disabled respectively.

`bucketConfig.json` example:

```json
{
  secretKey: "...",
  logLevel: "warn",
  offline: true,
  host: "https://proxy.slick-demo.com"
  featureOverrides: {
    huddles: true,
    voiceChat: false
  },
}
```

When using a `bucketConfig.json` for local development, make sure you add it to your
`.gitignore` file. You can also set these options directly in the `BucketClient`
constructor. The precedence for configuration options is as follows, listed in the
order of importance:

1. Options passed along to the constructor directly,
2. Environment variable,
3. The config file.

## Type safe feature flags

To get type checked feature flags, add the list of flags to your `bucket.ts` file.
Any feature look ups will now be checked against the list you maintain.

```typescript
// Extending the Features interface to define the available features
declare module "@bucketco/node-sdk" {
  interface Features {
    "show-todos": boolean;
    "create-todos": boolean;
    "delete-todos": boolean;
  }
}
```

![Type check failed](docs/type-check-failed.png "Type check failed")

## Using with Express

A popular way to integrate the Bucket Node.js SDK is through an express middleware.

```typescript
import bucket from "./bucket";
import express from "express";
import { BoundBucketClient } from "@bucketco/node-sdk";

// Augment the Express types to include a `boundBucketClient` property on the
// `res.locals` object.
// This will allow us to access the BucketClient instance in our route handlers
// without having to pass it around manually
declare global {
  namespace Express {
    interface Locals {
      boundBucketClient: BoundBucketClient;
    }
  }
}

// Add express middleware
app.use((req, res, next) => {
  // Extract the user and company IDs from the request
  // You'll want to use a proper authentication and identification
  // mechanism in a real-world application
  const user = {
    id: req.user?.id,
    name: req.user?.name
    email: req.user?.email
  }

  const company = {
    id: req.user?.companyId
    name: req.user?.companyName
  }

  // Create a new BoundBucketClient instance by calling the `bindClient`
  // method on a `BucketClient` instance
  // This will create a new instance that is bound to the user/company given.
  const boundBucketClient = bucket.bindClient({ user, company });

  // Store the BoundBucketClient instance in the `res.locals` object so we
  // can access it in our route handlers
  res.locals.boundBucketClient = boundBucketClient;
  next();
});

// Now use res.locals.boundBucketClient in your handlers
app.get("/todos", async (_req, res) => {
  const { track, isEnabled } = res.locals.bucketUser.getFeature("show-todos");

  if (!isEnabled) {
    res.status(403).send({"error": "feature inaccessible"})
    return
  }

  ...
}
```

See [example/app.ts](example/app.ts) for a full example.

## Remote flag evaluation with stored context

If you don't want to provide context each time when evaluating feature flags but
rather you would like to utilise the attributes you sent to Bucket previously
(by calling `updateCompany` and `updateUser`) you can do so by calling `getFeaturesRemote`
(or `getFeatureRemote` for a specific feature) with providing just `userId` and `companyId`.
These methods will call Bucket's servers and feature flags will be evaluated remotely
using the stored attributes.

```typescript
// Update user and company attributes
client.updateUser("john_doe", {
  attributes: {
    name: "John O.",
    role: "admin",
  },
});

client.updateCompany("acme_inc", {
  attributes: {
    name: "Acme, Inc",
    tier: "premium"
  },
});
...

// This will evaluate feature flags with respecting the attributes sent previously
const features = await client.getFeaturesRemote("acme_inc", "john_doe");
```

NOTE: User and company attribute updates are processed asynchronously, so there might
be a small delay between when attributes are updated and when they are available
for evaluation.

## Flushing

It is highly recommended that users of this SDK manually call `client.flush()`
method on process shutdown. The SDK employs a batching technique to minimize
the number of calls that are sent to Bucket's servers. During process shutdown,
some messages could be waiting to be sent, and thus, would be discarded if the
buffer is not flushed.

A naive example:

```typescript
process.on("SIGINT", () => {
  console.log("Flushing batch buffer...");
  client.flush().then(() => {
    process.exit(0);
  });
});
```

When you bind a client to a user/company, this data is matched against the
targeting rules. To get accurate targeting, you must ensure that the user/company
information provided is sufficient to match against the targeting rules you've
created. The user/company data is automatically transferred to Bucket. This ensures
that you'll have up-to-date information about companies and users and accurate
targeting information available in Bucket at all time.

## Tracking custom events and setting custom attributes

Tracking allows events and updating user/company attributes in Bucket.
For example, if a customer changes their plan, you'll want Bucket to know about it,
in order to continue to provide up-do-date targeting information in the Bucket interface.

The following example shows how to register a new user, associate it with a company
and finally update the plan they are on.

```typescript
// registers the user with Bucket using the provided unique ID, and
// providing a set of custom attributes (can be anything)
client.updateUser("user_id", {
  attributes: { longTimeUser: true, payingCustomer: false },
});
client.updateCompany("company_id", { userId: "user_id" });

// the user started a voice huddle
client.track("user_id", "huddle", { attributes: { voice: true } });
```

It's also possible to achieve the same through a bound client in the following manner:

```typescript
const boundClient = client.bindClient({
  user: { id: "user_id", longTimeUser: true, payingCustomer: false },
  company: { id: "company_id" },
});

boundClient.track("huddle", { attributes: { voice: true } });
```

Some attributes are used by Bucket to improve the UI, and are recommended
to provide for easier navigation:

- `name` -- display name for `user`/`company`,
- `email` -- the email of the user.

Attributes cannot be nested (multiple levels) and must be either strings,
integers or booleans.

## Managing `Last seen`

By default `updateUser`/`updateCompany` calls automatically update the given
user/company `Last seen` property on Bucket servers.

You can control if `Last seen` should be updated when the events are sent by setting
`meta.active = false`. This is often useful if you
have a background job that goes through a set of companies just to update their
attributes but not their activity.

Example:

```typescript
client.updateUser("john_doe", {
  attributes: { name: "John O." },
  meta: { active: true },
});

client.updateCompany("acme_inc", {
  attributes: { name: "Acme, Inc" },
  meta: { active: false },
});
```

`bindClient()` updates attributes on the Bucket servers but does not automatically
update `Last seen`.

### Zero PII

The Bucket SDK doesn't collect any metadata and HTTP IP addresses are _not_ being
stored. For tracking individual users, we recommend using something like database
ID as userId, as it's unique and doesn't include any PII (personal identifiable
information). If, however, you're using e.g. email address as userId, but prefer
not to send any PII to Bucket, you can hash the sensitive data before sending
it to Bucket:

```typescript
import { sha256 } from 'crypto-hash';

client.updateUser({ userId: await sha256("john_doe"), ... });
```

### Typescript

Types are bundled together with the library and exposed automatically when importing
through a package manager.

## License

> MIT License
> Copyright (c) 2024 Bucket ApS
