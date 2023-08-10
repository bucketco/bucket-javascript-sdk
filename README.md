# Bucket Tracking SDK

Isomorphic JS/TS tracking agent for [Bucket.co](https://bucket.co)

## Install

The library can be included directly as an external script or you can import it.

A. Script tag (client-side directly in html)

```html
<script src="https://cdn.jsdelivr.net/npm/@bucketco/tracking-sdk@1"></script>
```

B. Import module (in either node or browser bundling)

```js
import bucket from "@bucketco/tracking-sdk";
// or
var bucket = require("@bucketco/tracking-sdk");
```

Other languages than Javascript/Typescript are currently not supported by an SDK. You can [use the HTTP API directly](https://docs.bucket.co/reference/http-tracking-api)

## Usage

```js
// init the script with your Tracking Key
bucket.init("tk123", {});

// set current user
bucket.user("john_doe", { name: "John Doe" });

// set current company
bucket.company("acme_inc", { name: "Acme Inc", plan: "pro" }, "john_doe");

// track events
bucket.track("sent_message", { foo: "bar" }, "john_doe", "company_id");

// collect qualitative feedback
bucket.feedback({
  featureId: "my_feature_id",
  userId: "john_doe",
  companyId: "acme_inc", // String (optional)
  score: 5, // Number: 1-5 (optional)
  comment: "Absolutely stellar work!", // String (optional)
});
```

**NOTE**: When used in the browser, you can omit the 3rd argument (userId) to the `company` and `track` methods. See [persisting users](#persisting-users) for more details.

### Init options

Supply these to the `init` call (2nd argument)

```ts
{
  debug?: false, // enable debug mode to log all info and errors
  persistUser?: true | false // default value depends on environment, see below under "persisting users"
  automaticFeedbackPrompting?: false, // enable automatic feedback prompting (see below)
  feedbackPromptCallback?: undefined, // callback function to be called when feedback promp received from Bucket
  host?: "https://tracking.bucket.co", // don't change this
}
```

### Qualitative feedback

Bucket can collect qualitative feedback from your users in the form of a [Customer Satisfaction Score](https://en.wikipedia.org/wiki/Customer_satisfaction) and a comment. 
This feedback can be submitted either manually, through the SDK, or can be prompted automatically by Bucket (if configured at feature level).

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

#### Bucket feedback example UI

In order to collect feedback from a customer, you might want to build your own UI that matches your own style guide.

We have built a few scaffolds you can get started with easily:

- [Vanilla HTML/JS feedback form](./example/feedback/feedback.html)
- [React feedback form](./example/feedback/Feedback.jsx)

#### Bucket automatic feedback prompting

Bucket can automatically prompt your users for feedback when they use a feature that has feedback enabled. 
By default, this is disabled, but can be enabled by setting `automaticFeedbackPrompting: true` in the `init` options. 
If this option is enabled, the SDK will automatically connect to Bucket's servers on the first `user` call. Otherwise, 
one can manually initialize the feedback prompting by calling `initFeedbackPrompting` method for a given user.

Example for automatic feedback prompting:
```ts
// enable automatic feedback prompting (if enabled for the application)
bucket.init("tk123", { automaticFeedbackPrompting: true });
bucket.user("john_doe");

// switching users, will automatically reset the feedback prompt connection for the new user,
bucket.user("mary_doe");
```

Example for manual feedback prompting:
```ts
// enable automatic feedback prompting (if enabled for the application)
bucket.init("tk123");
bucket.initFeedbackPrompting("john_doe");

// custom UI for feedback prompt
const customCallback = (prompt) => {
  // show feedback prompt to user
  // ...
  // submit feedback
  bucket.feedback(feedback);
};

// requires a reset when switching users
bucket.reset();
bucket.initFeedbackPrompting("mary_doe", customCallback);
```

If the caller supplies a `feedbackPromptCallback` function in the `init` options, the SDK will call this function when 
it receives a feedback prompt from Bucket. Callers can configure a custom UI for the feedback prompt by using this callback.

Bucket SDK uses a persistent connection to Bucket's servers to receive feedback prompts. This connection is kept open 
until the user closes the browser tab or navigates away from the page, or the `reset` method is explicitly called.

### Zero PII

The Bucket SDK doesn't collect any metadata and HTTP IP addresses are _not_ being stored.

For tracking individual users, we recommend using something like database ID as userId, as it's unique and doesn't include any PII (personal identifiable information). If, however, you're using e.g. email address as userId, but prefer not to send any PII to Bucket, you can hash the sensitive data before sending it to Bucket:

```
import bucket from "@bucketco/tracking-sdk";
import { sha256 } from 'crypto-hash';

bucket.user(await sha256("john_doe"));
```

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
Once you call `user`, the userId will be persisted, so you don't have to supply userId to each subsequent `company` and `track` calls.
This is practical for client-side usage where a session always is a single user.

_Note: `automaticFeedbackPrompting` can only be enabled if `persistUser` is enabled._

**Usage in node.js**
User persistence is disabled by default when imported in node.js to avoid that companies or events are tied to the wrong user by mistake. This is because your server is (usually) not in a single user context.
Instead, you should provide the userId to each call, as the 3rd argument to `company` and `track`.

### Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

# License

MIT License

Copyright (c) 2023 Bucket ApS
