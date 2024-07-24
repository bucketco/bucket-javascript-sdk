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
// are available, such as supplying a logging sink, a custom HTTP client and
// other custom properties.
//
// We recommend that only one global instance of `client` should be created
// to avoid multiple round-trips to our servers.
const client = new BucketClient({
  secretKey: "sec_prod_xxxxxxxxxxxxxxxxxxxxx",
  fallbackFlags: { can_see_new_reports: true },
});

// Initialize the client and begin fetching flag definitions.
// You must call this method prior to any calls to `getFlags()`,
// otherwise an empty object will be returned.
//
// You can also supply your `fallbackFlags` to the `initialize()` method. These
// fallback flags are used in the situation when the server-side flags are not
// yet loaded or there are issues retrieving them.
// See "Initialization Options" below for more information.
await client.initialize();
```

At any point where the client needs to be used, we can configure it through
`withUser()`, `withCompany()` and `withOtherContext()` methods. Each of
these three methods returns a new instance of `Client` class which includes
the applied user, company or context:

```ts
// configure the client
const boundClient = client
  .withUser("john_doe", { attributes: { name: "John Doe" } })
  .withCompany("acme_inc", { attributes: { name "Acme Inc."} })
  .withOtherContext({ additional: "context", number: [1,2,3] })

const fallbackFlags = { can_see_new_reports: true  }

// actively wait for the flags to be loaded
await boundClient.initialize()
```

Once the client is initialized, one can obtain the evaluated flags:

```ts
// get the current flags (uses company, user and custom context to evaluate the flags).
const flags = boundClient.getFlags();

if (flags.can_see_new_reports) {
  // this is your flag-protected code ...
  // send an event when the feature is used:
  boundClient.trackFeatureUsage("new_reports_used", {
    attributes: {
      some: "attribute",
    },
  });
}
```

## Tracking

Tracking allows sending `user`, `company` and `event` messages to Bucket.
`user` events can be used to register or update an user's attributes
with Bucket. `company` allows the same, and additionally, allows
associating an user with a company on the Bucket side. Finally, `event`
is used to track feature usage across your application.

The following example shows how to register a new user, and associate it with a company:

```ts
// registers the user with Bucket using the provided unique ID, and
// providing a set of custom attributes (can be anything)
const boundClient = client
  .withUser("your_user_id", {
    attributes: { longTimeUser: true, payingCustomer: false },
  })
  .withCompany("company_id");

// track the user (send a `user` event to Bucket).
await boundClient.updateUser();

// register the user as being part of a given company
boundClient.updateCompany();
```

If one needs to simply update a company's attributes on Bucket side,
one calls `updateCompany` without supplying a user ID:

```ts
// either creates a new company on Bucket or updates an existing
// one by supplying custom attributes
client.withCompany("updated_company_id").updateCompany({
  attributes: {
    status: "active",
    plan: "trial",
  },
});

// if a company is not active, and one needs to make sure its
// "Last Seen" status does not get updated, one can supply
// an additional meta argument at the end:
client
  .withCompany("updated_company_id", {
    attributes: { status: "active", plan: "trial" },
  })
  .updateCompany({ meta: { active: false } });
```

To generate feature tracking `event`s:

```ts
// this simply sends an event to Bucket, not associated with any company or user.
client.trackFeatureUsage("some_feature_name");

// to specify to which user/company this event belongs one can do
client
  .withUser("user_id")
  .withCompany("company_id")
  .trackFeatureUsage("some_feature_name");
```

### Initialization Options

Supply these to the `constructor` of the `Client` class:

```ts
{
  // The secret key used to authenticate with the Bucket API.
  secretKey: string,
  // The host to send requests to (optional).
  host?: string = "https://front.bucket.co",
  // The logger you can supply. By default no logging is performed.
  logger?: Logger,
  // The custom http client. By default the internal `fetchClient` is used.
  httpClient?: HttpClient = fetchCient,
  // A map of fallback flags that will be used when no actual flags
  // are available yet.
  fallbackFlags?: Record<string, boolean>
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

client.withUser({ userId: await sha256("john_doe"), ... });
```

### Custom Attributes & Context

You can pass attributes as part of the object literal passed to the `withUser()`,
`withCompany()`, `updateUser`, `updateCompany` and `trackFeatureUsage()`, methods.
Attributes cannot be nested (multiple levels) and must be either strings,
integers or booleans.

Some attributes are used by Bucket.co to improve the UI, and are recommended
to provide for easier navigation:

- `name` or `$name` -- display name for `user`/`company`,
- `email` or `$email` -- the email of the user.

You can supply an additional `context` to these functions as well. The `context`
object contains additional data that Bucket uses to make some behavioural choices.

By default, `updateUser`, `updateCompany` and `trackFeatureUsage` calls
automatically update the given user/company `Last seen` property on Bucket side.
You can control if `Last seen` should be updated when the events are sent by setting
`meta.active = false`. This is often useful if you
have a background job that goes through a set of companies just to update their
attributes but not their activity.

Example:

```ts
client.updateUser({
  attributes: { name: "John O." },
  meta: { active: true },
});

client.updateCompany({
  attributes: { name: "My SaaS Inc." },
  meta: { active: false },
});
```

### Typescript

Types are bundled together with the library and exposed automatically when importing
through a package manager.

## License

> MIT License
> Copyright (c) 2024 Bucket ApS
