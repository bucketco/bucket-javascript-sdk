# Bucket Tracking SDK

Isomorphic JS/TS tracking agent for [Bucket.co](https://bucket.co)

## Install

The library can be included directly as an external script or you can import it.

A. Script tag (client-side directly in html)

```html
<script src="https://cdn.jsdelivr.net/npm/@bucketco/tracking-sdk@2"></script>
```

B. Import module (in either node or browser bundling)

```js
import bucket from "@bucketco/tracking-sdk";
// or
var bucket = require("@bucketco/tracking-sdk");
```

Other languages than Javascript/Typescript are currently not supported by an SDK. You can [use the HTTP API directly](https://docs.bucket.co/reference/http-tracking-api)

## Basic usage

```js
// init the script with your Tracking Key
bucket.init("tk123", {});

// set current user
bucket.user("john_doe", { name: "John Doe" });

// set current company
bucket.company("acme_inc", { name: "Acme Inc", plan: "pro" }, "john_doe");

// track events
bucket.track("sent_message", { foo: "bar" }, "john_doe", "company_id");
```

**NOTE**: When used in the browser, you can omit the 3rd argument (userId) to the `company` and `track` methods. See [persisting users](#persisting-users) for more details.

### Init options

Supply these to the `init` call (2nd argument)

```ts
{
  debug?: false, // enable debug mode to log all info and errors
  persistUser?: true | false // default value depends on environment, see below under "persisting users"
  host?: "https://tracking.bucket.co",
  sseHost?: "https://livemessaging.bucket.co"
}
```

### Qualitative feedback

Bucket can collect qualitative feedback from your users in the form of a [Customer Satisfaction Score](https://en.wikipedia.org/wiki/Customer_satisfaction) and a comment.

#### Live Satisfaction collection

The Bucket SDK comes with a Live Satisfaction collection mode enabled by default, which lets the Bucket service ask your users for feedback for relevant features just after they've used them.

Note: To get started with automatic feedback collection, make sure you call `bucket.user()`.

Live Satisfaction works even if you're not using the SDK to send events to Bucket.
It works because the Bucket SDK maintains a live connection to Bucket's servers and can show a Live Satisfaction prompt whenever the Bucket servers determines that an event should trigger a prompt - regardless of how this event is sent to Bucket.

You can find all the options to make changes to the default behaviour in the [Bucket feedback documentation](./FEEDBACK.md).

#### Bucket feedback UI

Bucket can assist you with collecting your user's feedback by offering a pre-built UI, allowing you to get started with minimal code and effort.

![image](https://github.com/bucketco/bucket-tracking-sdk/assets/34348/c387bac1-f2e2-4efd-9dda-5030d76f9532)

[Read the Bucket feedback UI documentation](./FEEDBACK.md)

#### Bucket feedback SDK

Feedback can be submitted to Bucket using the SDK:

```js
bucket.feedback({
  featureId: "my_feature_id", // String (required), copy from Feature feedback tab
  userId: "john_doe", // String, optional if using user persistence
  companyId: "acme_inc", // String (optional)
  score: 5, // Number: 1-5 (optional)
  comment: "Absolutely stellar work!", // String (optional)
});
```

#### Bucket feedback API

If you are not using the Bucket SDK, you can still submit feedback using the HTTP API.

See details in [Feedback HTTP API](https://docs.bucket.co/reference/http-tracking-api#feedback)

### Zero PII

The Bucket SDK doesn't collect any metadata and HTTP IP addresses are _not_ being stored.

For tracking individual users, we recommend using something like database ID as userId, as it's unique and doesn't include any PII (personal identifiable information). If, however, you're using e.g. email address as userId, but prefer not to send any PII to Bucket, you can hash the sensitive data before sending it to Bucket:

```
import bucket from "@bucketco/tracking-sdk";
import { sha256 } from 'crypto-hash';

bucket.user(await sha256("john_doe"));
```

### Use of cookies

The Bucket SDK uses a couple of cookies to support Live Satisfaction. These cookies are not used for tracking purposes and thus should not need to appear in cookie consent forms.

The two cookies are:

- `bucket-prompt-${userId}`: store the last Live Satisfaction prompt message ID received to avoid repeating prompts
- `bucket-token-${userId}`: caching a token used to connect to Bucket's live messaging infrastructure that is used to deliver Live Satisfaction prompts in real time.

### Custom attributes

You can pass attributes as a object literal to the `user`, `company` and `track` methods (2nd argument).
Attributes cannot be nested (multiple levels) and must be either strings, integers or booleans.

Built-in attributes:

- `name` (display name for user/company)

### Context

You can supply additional `context` to `group`, `user` and `event` calls.

#### context.active

By default, sending `group`, `user` and `event` calls automatically update the given user/company "Last seen" property.
You can control if "Last seen" should be updated when the events are sent by setting `context.active=false` to avoid updating last seen.
This is often useful if you have a background job that goes through a set of companies just to update their attributes or similar

```typescript
// set current company without updating last seen.
bucket.company("acme_inc", { name: "Acme Inc", plan: "pro" }, "john_doe", {
  active: false,
});
```

### Persisting users

**Usage in the browser** (imported or script tag):
Once you call `user`, the userId will be persisted so you don't have to supply userId to each subsequent `company` and `track` calls.
This is practical for client-side usage where a session always is a single user.

**Usage in node.js**
User persistence is disabled by default when imported in node.js to avoid that companies or events are tied to the wrong user by mistake. This is because your server is (usually) not in a single user context.
Instead, you should provide the userId to each call, as the 3rd argument to `company` and `track`.

### Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

## Content Security Policy (CSP)

If you are running with strict Content Security Policies active on your website, you will need to enable these directives in order to use the SDK:

| Directive   | Values                          | Module            | Reason                                                                                                                                       |
| ----------- | ------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| connect-src | https://tracking.bucket.co      | tracking          | Used for all tracking methods: `bucket.user()`, `bucket.company()`, `bucket.track()` and `bucket.feedback()`                                 |
| connect-src | https://livemessaging.bucket.co | live satisfaction | Server sent events from the Bucket Live Satisfaction service, which allows for automatically collecting feedback when a user used a feature. |
| style-src   | 'unsafe-inline'                 | feedback UI       | The feedback UI is styled with inline styles. Not having this directive results unstyled HTML elements.                                      |

If you are including the Bucket tracking SDK with a `<script>`-tag from `jsdelivr.net` you will also need:

| Directive       | Values                   | Module    | Reason                                   |
| --------------- | ------------------------ | --------- | ---------------------------------------- |
| script-src-elem | https://cdn.jsdelivr.net | bootstrap | Loads the Bucket tracking SDK from a CDN |

# License

MIT License

Copyright (c) 2023 Bucket ApS
