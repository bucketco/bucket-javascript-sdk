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

```ts
import { BucketClient } from "@bucketco/node-sdk";

// Create a new instance of the client with the secret key. Additional options
// are available, such as supplying a logger, fallback features and
// other custom properties.
//
// Fallback features are used in the situation when the server-side
// features are not yet loaded or there are issues retrieving them.
// See "Initialization Options" below for more information.
//
// We recommend that only one global instance of `client` should be created
// to avoid multiple round-trips to our servers.
const client = new BucketClient({
  secretKey: "sec_prod_xxxxxxxxxxxxxxxxxxxxx",
  fallbackFeatures: ["huddle", "voice-huddle"],
});

// Initialize the client and begin fetching feature targeting definitions.
// You must call this method prior to any calls to `getFeatures()`,
// otherwise an empty object will be returned.
await client.initialize();
```

Once the client is initialized, you can obtain features along with the isEnabled status to indicate whether the feature is targeted for this user/company:

```ts
// configure the client
const boundClient = client.bindClient({
  user: { id: "john_doe", name: "John Doe" },
  company: { id: "acme_inc", name: "Acme, Inc." },
});

// get the current features (uses company, user and custom context to evaluate the features).
const { huddle } = boundClient.getFeatures();

if (huddle.isEnabled) {
  // this is your feature gated code ...
  // send an event when the feature is used:
  huddle.track();

  // CAUTION: if need the track event to be sent to Bucket as soon as possible,
  // always call `flush`. It can optionally be awaited to guarantee the sent happened.
  client.flush();
}
```

It is highly recommended that users of this SDK manually call `client.flush()` method on process shutdown. The SDK employs
a batching technique to minimize the number of calls that are sent to Bucket's servers. During process shutdown, some
messages could be waiting to be sent, and thus, would be discarded if the buffer is not flushed.

A naive example:

```ts
process.on("beforeExit", (code) => {
  client.flush();
});
```

When you bind a client to a user/company, this data is matched against the targeting rules.
To get accurate targeting, you must ensure that the user/company information provided is sufficient to match against the targeting rules you've created.
The user/company data is automatically transferred to Bucket.
This ensures that you'll have up-to-date information about companies and users and accurate targeting information available in Bucket at all time.

## High performance feature targeting

The Bucket Node SDK contacts the Bucket servers when you call `initialize`
and downloads the features with their targeting rules.
These rules are then matched against the user/company information you provide
to `getFeatures` (or through `bindClient(..).getFeatures()`). That means the
`getFeatures` call does not need to contact the Bucket servers once initialize
has completed. `BucketClient` will continue to periodically download the
targeting rules from the Bucket servers in the background.

## Tracking custom events and setting custom attributes

Tracking allows events and updating user/company attributes in Bucket. For example, if a
customer changes their plan, you'll want Bucket to know about it in order to continue to
provide up-do-date targeting information in the Bucket interface.

The following example shows how to register a new user, associate it with a company and
finally update the plan they are on.

```ts
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

```ts
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

```ts
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

### Initialization Options

Supply these to the `constructor` of the `BucketClient` class:

```ts
{
  // The secret key used to authenticate with the Bucket API.
  secretKey: string,
  // The host to send requests to (optional).
  host?: string = "https://front.bucket.co",
  // The logger you can supply. By default no logging is performed.
  logger?: Logger,
  // The custom http client. By default the internal `fetchClient` is used.
  httpClient?: HttpClient = fetchClient,
  // A list of fallback features that will be enabled the Bucket servers
  // have not been contacted yet.
  fallbackFeatures?: string[]
}
```

### Zero PII

The Bucket SDK doesn't collect any metadata and HTTP IP addresses are _not_ being
stored. For tracking individual users, we recommend using something like database
ID as userId, as it's unique and doesn't include any PII (personal identifiable
information). If, however, you're using e.g. email address as userId, but prefer
not to send any PII to Bucket, you can hash the sensitive data before sending
it to Bucket:

```ts
import { sha256 } from 'crypto-hash';

client.updateUser({ userId: await sha256("john_doe"), ... });
```

### Typescript

Types are bundled together with the library and exposed automatically when importing
through a package manager.

## License

> MIT License
> Copyright (c) 2024 Bucket ApS
