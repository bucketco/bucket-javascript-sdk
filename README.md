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

// send qualitative feedback
bucket.feedback({
  featureId: "my_feature_id",
  userId: "john_doe",
  companyId: "acme_inc", // String (optional)
  score: 5, // Number: 1-5 (optional)
  comment: "Absolutely stellar work!", // String (optional)
});

// collect qualitative feedback using built-in dialog
bucket.openFeedbackForm({
  featureId: "my_feature_id",
  userId: "john_doe",
  companyId: "acme_inc", // String (optional)
  // supply onSubmit to overwrite default call to bucket.feedback(...)
});
```

**NOTE**: When used in the browser, you can omit the 3rd argument (userId) to the `company` and `track` methods. See [persisting users](#persisting-users) for more details.

### Init options

Supply these to the `init` call (2nd argument)

```ts
{
  debug?: false, // enable debug mode to log all info and errors
  persistUser?: true | false // default value depends on environment, see below under "persisting users"
  host?: "https://tracking.bucket.co", // don't change this
}
```

### Qualitative feedback

Bucket can collect qualitative feedback from your users in the form of a [Customer Satisfaction Score](https://en.wikipedia.org/wiki/Customer_satisfaction) and a comment.

#### Bucket feedback SDK

Feedback can be submitted to Bucket using the SDK:

```js
bucket.feedback({
  featureId: "my_feature_id", // String (required), copy from Feature feedback tab
  userId: "john_doe", // String, (optional) if using user persistence
  companyId: "acme_inc", // String (optional)
  score: 5, // Number: 1-5 (optional)
  comment: "Absolutely stellar work!", // String (optional)
});
```

Or by prompting a user through the built-in dialog.

```js
bucket.openFeedbackForm({
  featureId: "my_feature_id", // String (required), copy from Feature feedback tab
  userId: "john_doe", // String, (optional) if using user persistence
  companyId: "acme_inc", // String (optional)
  title: "How do you like feature A?", // String (optional), dialog title
  isModal: true, // Boolean (optional), dialog is a blocking modal, default false
  anchor: trigger, // HTMLElement (optional), displays dialog by trigger
  placement: "top-right", // String (optional), corner placement if not anchored
  quickDismiss: false, // Boolean (optional), escape and click outside to close, default true
  onSubmit: (data: Feedback) => Promise<any>, // Function (optional), override default submit function
  onClose: () => void, // Function (optional), called when dialog is dismissed
});
```

#### Styling Bucket's feedback dialog

Styling the dialog can be done using custom CSS properties. Below are the default ones:

```css
:root {
  --bucket-feedback-dialog-font-size: 1rem;
  --bucket-feedback-dialog-font-family: InterVariable, Inter, system-ui, Open Sans, sans-serif;
  --bucket-feedback-dialog-bg: #fff;
  --bucket-feedback-dialog-color: #1e1f24;
  --bucket-feedback-dialog-radius: 6px;
  --bucket-feedback-dialog-border: #d8d9df;
  --bucket-feedback-dialog-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --bucket-feedback-dialog-primary-bg: #655bfa;
  --bucket-feedback-dialog-primary-fg: white;
  --bucket-feedback-dialog-input-border: #d8d9df;
  --bucket-feedback-dialog-error-fg: #e53e3e;

  --bucket-feedback-dialog-very-dissatisfied-color: #dd6b20;
  --bucket-feedback-dialog-very-dissatisfied-bg: #fbd38d;
  --bucket-feedback-dialog-dissatisfied-color: #ed8936;
  --bucket-feedback-dialog-dissatisfied-bg: #feebc8;
  --bucket-feedback-dialog-neutral-color: #787c91;
  --bucket-feedback-dialog-neutral-bg: #e9e9ed;
  --bucket-feedback-dialog-satisfied-color: #48bb78;
  --bucket-feedback-dialog-satisfied-bg: #c6f6d5;
  --bucket-feedback-dialog-very-satisfied-color: #38a169;
  --bucket-feedback-dialog-very-satisfied-bg: #9ae6b4;
}
```

#### Bucket feedback API

If you are not using the Bucket SDK, you can still submit feedback using the HTTP API.

See details in [Feedback HTTP API](https://docs.bucket.co/reference/http-tracking-api#feedback)

#### Bucket feedback example UI

In order to collect feedback from a customer, you might want to build your own UI that matches your own style guide.

We have built a few scaffolds you can get started with easily:

- [Vanilla HTML/JS feedback form](./example/feedback/feedback.html)
- [React feedback form](./example/feedback/Feedback.jsx)

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
Once you call `user`, the userId will be persisted so you don't have to supply userId to each subsequent `company` and `track` calls.
This is practical for client-side usage where a session always is a single user.

**Usage in node.js**
User persistence is disabled by default when imported in node.js to avoid that companies or events are tied to the wrong user by mistake. This is because your server is (usually) not in a single user context.
Instead, you should provide the userId to each call, as the 3rd argument to `company` and `track`.

### Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

# License

MIT License

Copyright (c) 2023 Bucket ApS
