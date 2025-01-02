# Bucket Browser SDK

Basic client for Bucket.co. If you're using React, you'll be better off with the Bucket React SDK.

## Install

First find your `publishableKey` under [environment settings](https://app.bucket.co/envs/current/settings/app-environments) in Bucket.

The package can be imported or used directly in a HTML script tag:

A. Import module

```ts
import { BucketClient } from "@bucketco/browser-sdk";

const user = {
  id: 42,
  role: "manager",
};

const company = {
  id: 99,
  plan: "enterprise",
};

const bucketClient = new BucketClient({ publishableKey, user, company });

await bucketClient.initialize();

const { isEnabled, track, requestFeedback } = bucketClient.getFeature("huddle");

if (isEnabled) {
  // show feature. When retrieving `isEnabled` the client automatically
  // sends a "check" event for the "huddle" feature which is shown in the
  // Bucket UI.

  // On usage, call `track` to let Bucket know that a user interacted with the feature
  track();

  // Use `requestFeedback` to create "Send feedback" buttons easily for specific
  // features. This is not related to `track` and you can call them individually.
  requestFeedback({ title: "Tell us what you think of Huddles" });
}

// `track` just calls `bucketClient.track(<featureKey>)` to send an event using the same feature key
// You can also use `track` on the client directly to send any custom event.
bucketClient.track("huddle");

// similarly, `requestFeedback` just calls `bucketClient.requestFeedback({featureKey: <featureKey>})`
// which you can also call directly:
bucketClient.requestFeedback({ featureKey: "huddle" });
```

B. Script tag (client-side directly in html)

See [example/browser.html](example/browser.html) for a working example:

```html
<script src="https://cdn.jsdelivr.net/npm/@bucketco/browser-sdk@2"></script>
<script>
  const bucket = new BucketBrowserSDK.BucketClient({
    publishableKey: "publishableKey",
    user: { id: "42" },
    company: { id: "1" },
  });

  bucket.initialize().then(() => {
    console.log("Bucket initialized");
    document.getElementById("loading").style.display = "none";
    document.getElementById("start-huddle").style.display = "block";
  });
</script>
<span id="loading">Loading...</span>
<button
  id="start-huddle"
  style="display: none"
  onClick="bucket.track('Started huddle')"
>
  Click me
</button>
```

### Init options

Supply these to the constructor call:

```ts
type Configuration = {
  logger: console, // by default only logs warn/error, by passing `console` you'll log everything
  apiBaseUrl?: "https://front.bucket.co",
  sseBaseUrl?: "https://livemessaging.bucket.co",
  feedback?: undefined, // See FEEDBACK.md
  enableTracking?: true, // set to `false` to stop sending track events and user/company updates to Bucket servers. Useful when you're impersonating a user.
  featureOptions?: {
    fallbackFeatures?: string[], // Enable these features if unable to contact bucket.co
    timeoutMs?: number, // Timeout for fetching features
    staleWhileRevalidate?: boolean, // Revalidate in the background when cached features turn stale to avoid latency in the UI
    staleTimeMs?: number, // at initialization time features are loaded from the cache unless they have gone stale. Defaults to 0 which means the cache is disabled. Increase in the case of a non-SPA.
    expireTimeMs?: number, // In case we're unable to fetch features from Bucket, cached/stale features will be used instead until they expire after  `expireTimeMs`.
  };
}
```

### Feature toggles

Bucket determines which features are active for a given user/company. The user/company is given in the BucketClient constructor.

If you supply `user` or `company` objects, they must include at least the `id` property otherwise they will be ignored in their entirety.
In addition to the `id`, you must also supply anything additional that you want to be able to evaluate feature targeting rules against.

Attributes cannot be nested (multiple levels) and must be either strings, integers or booleans.

- `name` is a special attribute and is used to display name for user/company
- for `user`, `email` is also special and will be highlighted in the Bucket UI if available

```ts
const bucketClient = new BucketClient({
  publishableKey,
  user: { id: "user_123", name: "John Doe", email: "john@acme.com" },
  company: { id: "company_123", name: "Acme, Inc" },
});
```

To retrieve features along with their targeting information, use `getFeature(key: string)`:

```ts
const huddle = bucketClient.getFeature("huddle");
// {
//   isEnabled: true,
//   track: () => Promise<Response>
//   requestFeedback: (options: RequestFeedbackData) => void
// }
```

You can use `getFeatures()` to retrieve all enabled features currently.

```ts
const features = bucketClient.getFeatures();
// {
//   huddle: {
//     isEnabled: true,
//     targetingVersion: 42,
//   }
// }
```

`getFeatures()` is meant to be more low-level than `getFeature()` and it typically used
by down-stream clients, like the React SDK.

Note that accessing `isEnabled` on the object returned by `getFeatures` does not automatically
generate a `check` event, contrary to the `isEnabled` property on the object return from `getFeature`.

### Tracking feature usage

The `track` function lets you send events to Bucket to denote feature usage.
By default Bucket expects event names to align with the feature keys, but
you can customize it as you wish.

```ts
bucketClient.track("huddle", { voiceHuddle: true });
```

### Qualitative feedback

Bucket can collect qualitative feedback from your users in the form of a [Customer Satisfaction Score](https://en.wikipedia.org/wiki/Customer_satisfaction) and a comment.

#### Automated feedback collection

The Bucket Browser SDK comes with automated feedback collection mode enabled by default, which lets the Bucket service ask your users for feedback for relevant features just after they've used them.

Note: To get started with automatic feedback collection, make sure you've set `user` in the `BucketClient` constructor.

Automated feedback surveys work even if you're not using the SDK to send events to Bucket.
It works because the Bucket Browser SDK maintains a live connection to Bucket's servers and can automatically show a feedback prompt whenever the Bucket servers determines that an event should trigger a prompt - regardless of how this event is sent to Bucket.

You can find all the options to make changes to the default behavior in the [Bucket feedback documentation](./FEEDBACK.md).

#### Bucket feedback UI

Bucket can assist you with collecting your user's feedback by offering a pre-built UI, allowing you to get started with minimal code and effort.

![image](https://github.com/bucketco/bucket-javascript-sdk/assets/34348/c387bac1-f2e2-4efd-9dda-5030d76f9532)

[Read the Bucket feedback UI documentation](./FEEDBACK.md)

#### Bucket feedback SDK

Feedback can be submitted to Bucket using the SDK:

```js
bucketClient.feedback({
  featureId: "my_feature_id", // String (required), copy from Feature feedback tab
  score: 5, // Number: 1-5 (optional)
  comment: "Absolutely stellar work!", // String (optional)
});
```

#### Bucket feedback API

If you are not using the Bucket Browser SDK, you can still submit feedback using the HTTP API.

See details in [Feedback HTTP API](https://docs.bucket.co/reference/http-tracking-api#feedback)

### Zero PII

The Bucket Browser SDK doesn't collect any metadata and HTTP IP addresses are _not_ being stored.

For tracking individual users, we recommend using something like database ID as userId, as it's unique and doesn't include any PII (personal identifiable information). If, however, you're using e.g. email address as userId, but prefer not to send any PII to Bucket, you can hash the sensitive data before sending it to Bucket:

```
import bucket from "@bucketco/browser-sdk";
import { sha256 } from 'crypto-hash';

bucket.user(await sha256("john_doe"));
```

### Use of cookies

The Bucket Browser SDK uses a couple of cookies to support automated feedback surveys. These cookies are not used for tracking purposes and thus should not need to appear in cookie consent forms.

The two cookies are:

- `bucket-prompt-${userId}`: store the last automated feedback prompt message ID received to avoid repeating surveys
- `bucket-token-${userId}`: caching a token used to connect to Bucket's live messaging infrastructure that is used to deliver automated feedback surveys in real time.

### Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

## Content Security Policy (CSP)

If you are running with strict Content Security Policies active on your website, you will need to enable these directives in order to use the SDK:

| Directive   | Values                          | Reason                                                                                                                                   |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| connect-src | https://front.bucket.co         | Basic functionality`                                                                                                                     |
| connect-src | https://livemessaging.bucket.co | Server sent events for use in automated feedback surveys, which allows for automatically collecting feedback when a user used a feature. |
| style-src   | 'unsafe-inline'                 | The feedback UI is styled with inline styles. Not having this directive results unstyled HTML elements.                                  |

If you are including the Bucket tracking SDK with a `<script>`-tag from `jsdelivr.net` you will also need:

| Directive       | Values                   | Reason                          |
| --------------- | ------------------------ | ------------------------------- |
| script-src-elem | https://cdn.jsdelivr.net | Loads the Bucket SDK from a CDN |

# License

MIT License

Copyright (c) 2024 Bucket ApS
