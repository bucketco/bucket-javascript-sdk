# Bucket Browser SDK

Basic client for Bucket.co. If you're using React, you'll be better off with the Bucket React SDK.

## Install

The package can be imported or used direclty in a HTML script tag:

A. Import module

```ts
import bucket from "@bucketco/browser-sdk";

const user = {
  id: 42,
  role: "manager",
};

const company = {
  id: 99,
  plan: "enterprise",
};

const bucketClient = new BucketClient(publishableKey, { user, company });

await bucketClient.initialize();

const { huddle } = bucketClient.getFeatures();

if (huddle) {
  // show feature
}

// on feature usage, send an event using the same feature key
// to get feature usage tracked automatically.
// You can also use `track` to send any custom event.
bucketClient.track("huddle");
```

B. Script tag (client-side directly in html)

See [example/browser.html](example/browser.html) for a working example:

```html
<script src="https://cdn.jsdelivr.net/npm/@bucketco/browser-sdk@1"></script>
<script>
  const bucket = new BucketBrowserSDK.BucketClient("123", {
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

Supply these to the constructor call (3rd argument)

```ts
{
  logger: console, // by default only logs warn/error, by passing `console` you'll log everything
  host?: "https://front.bucket.co",
  sseHost?: "https://livemessaging.bucket.co"
  feedback?: undefined // See FEEDBACK.md
  featureOptions?: {
    fallbackFeatures?: string[]; // Enable these features if unable to contact bucket.co
    timeoutMs?: number; // Timeout for fetching features
    staleWhileRevalidate?: boolean; // Revalidate in the background when cached features turn stale to avoid latency in the UI
    failureRetryAttempts?: number | false; // Cache a negative response after `failureRetryAttempts` attempts to avoid latency in the UI
  };
}
```

### Feature toggles

Bucket can determine which features are active for a given context. The context is given in the BucketClient constructor.

The context should take the form of `{ user: { id }, company: { id } }` plus anything additional you want to be able to evaluate feature targeting rules against.

```ts
const bucketClient = new BucketClient(
  publishableKey,
  context: {
    user: { id: "user_123", role: "manager" },
    company: { id: "company_123", plan: "enterprise" },
  },
);
await bucketClient.initialize()

bucketClient.getFeatures()
// {
//   "huddle": true,
//   "message": true
// }

if(bucketClient.getFeatures().huddle) {
  ...
}
```

### Qualitative feedback

Bucket can collect qualitative feedback from your users in the form of a [Customer Satisfaction Score](https://en.wikipedia.org/wiki/Customer_satisfaction) and a comment.

#### Live Satisfaction collection

The Bucket Browser SDK comes with a Live Satisfaction collection mode enabled by default, which lets the Bucket service ask your users for feedback for relevant features just after they've used them.

Note: To get started with automatic feedback collection, make sure you call `bucket.user()`.

Live Satisfaction works even if you're not using the SDK to send events to Bucket.
It works because the Bucket Browser SDK maintains a live connection to Bucket's servers and can show a Live Satisfaction prompt whenever the Bucket servers determines that an event should trigger a prompt - regardless of how this event is sent to Bucket.

You can find all the options to make changes to the default behaviour in the [Bucket feedback documentation](./FEEDBACK.md).

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

### Use of cookies

The Bucket Browser SDK uses a couple of cookies to support Live Satisfaction. These cookies are not used for tracking purposes and thus should not need to appear in cookie consent forms.

The two cookies are:

- `bucket-prompt-${userId}`: store the last Live Satisfaction prompt message ID received to avoid repeating prompts
- `bucket-token-${userId}`: caching a token used to connect to Bucket's live messaging infrastructure that is used to deliver Live Satisfaction prompts in real time.

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

Copyright (c) 2024 Bucket ApS
