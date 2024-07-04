# Bucket Node.js SDK

Node.js, JavaScriptS/Typescript feature flag and tracking client for [Bucket.co](https://bucket.co).

## Installation

Install using `yarn` or `npm` with:

> `yarn add -s @bucketco/node-sdk` or `npm install -s @bucketco/node-sdk`.

Other languages than JavaScript/Typescript are currently not supported by an SDK.
You can [use the HTTP API directly](https://docs.bucket.co/reference/http-tracking-api)

## Basic usage

Before the library can be used, you need to obtain a secret key from
[Environment setting view](https://app.bucket.co/envs/{environment}/settings/app-environments)
in **Bucket.co**.

> [!CAUTION] 
> Ssecret keys should only be used by the `node-sdk` and not any other
> SDKs provided by Bucket. Secret keys offer the users the ability to obtain
> information that is often sensitive and thus should not be used in any
> front-end application.

```ts
import { Client } from "@bucketco/node-sdk";

// Create a new instance of the client with the secret key. Additional options
// are available, such as supplying a logging sink, a custom HTTP client and
// other custom properties.
//
// We recommend that only one global instance of `client` should be created
// to avoid multiple round-trips to our servers.
const client = new Client({ secretKey: "sec_prod_xxxxxxxxxxxxxxxxxxxxx" });

// Initialize the client's feature flag retrieval loop. This is not a mandatory
// call, but it is recommended in order to warm up the cache so that future
// calls to `getFlags()` will have cached flag definitions available.
//
// You can also supply your `fallbackFlags` to the `initialize()` method. These
// fallback flags are used in the situation when the server-side flags are not
// yet loaded or there are issues retrieving them.
await client.initialize();
```

At any point where the client needs to be used, we can configure it through
`withUsr()`, `withCompany()` and `withCompanyContext()` methods. Each of
these three methods returns a new instance of `Client` class which includes
the applied user, company or context:

```ts
// configure the client
const boundClient = client
  .withUser({ id: "john_doe" name: "John Doe" })
  .withCompany({ id: "acme_inc", name "Acme Inc."})
  .withCustomContext({ additional: "context", number: [1,2,3] })

```

See [types](./src/types.ts) for more details on the supported types.

You can then then use the `boundClient` to perform all the supported functionality:

```ts
// update the user with Bucket (await it optional)
await boundClient.updateUser();

// update the associated company with Bucket
await boundClient.updateCompany();

// get the current flags (uses company, user and custom context to evaluate the flags).
const flags = boundClient.getFlags();
if (flags.enable_custom_login) {
  // this is your flag-protected code ...
  // send an event whet the feature is used:
  boundClient.trackFeatureUsage({
    event: "custom_login_used",
    attributtes: { some: "attribute" },
  });
}
```

### Initialization Options

Supply these to the `constructor` of the `Client` class:

```ts
{
  // The secret key used to authenticate with the Bucket API.
  secretKey: string,
  // The host to send requests to (optional).
  host?: string = "https://tracking.bucket.co",
  // The interval to re-fetch feature flag definitions (optional).
  // Default is 60 seconds.
  refetchInterval?: number = 60000,
  // The interval to re-fetch feature flags (optional). Default
  // is 5 times the re-fetch interval.
  staleWarningInterval?: number = 5 * 60000,
  // The logger you can supply. By default no logging is performed.
  logger?: Logger;
  // The custom http client. By default the internal `fetchClient` is used.
  httpClient?: HttpClient = fetchCient,
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
`withCompany()` and `trackFeatureUsage()` methods. Attributes cannot be nested
(multiple levels) and must be either strings, integers or booleans.

Some attributes are used by Bucket.co and manged separately, such as:

- `name` or `$name` -- display name for `user`/`company`,
- `email` or `$email` -- the email of the user.

You can supply an additional `context` to these functions as well. The `context`
object contains additional data that Bucket uses to make some behavioural choices.

By default, sending `updateCompany`, `updateUser` and `trackFeatureUsage` calls
automatically update the given user/company `Last seen` property. You can control
if `Last seen` should be updated when the events are sent by setting
`context.active = false` to avoid updating last seen. This is often useful if you
have a background job that goes through a set of companies just to update their.

Example:

```ts
// create a new client initialized with an user and a company.
const boundClient = client
  .withUser({
    userId: "188762",
    attributes: { name: "John O." },
    context: { active: true },
  })
  .withCompany({
    companyId: "0083663",
    attributes: { name: "My SaaS Inc." },
    context: { active: false },
  });

// send updates to Bucket.co with the new details.
await boundClient.updateCompany();
await boundClient.updateUser();
```

### Typescript

Types are bundled together with the library and exposed automatically when importing
through a package manager.

## License

> MIT License
> Copyright (c) 2024 Bucket ApS
