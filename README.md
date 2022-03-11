# Bucket Tracking SDK

Isomorphic JS/TS tracking agent for [Bucket.co](https://bucket.co)

## Install

The library can be included directly as an external script or you can import it.

A. Script tag (client-side directly in html)

```html
<script src="https://cdn.bucket.co/tracking-sdk.v1.js"></script>
```

B. Import module (either in node or browser bundling)

```js
import bucket from "@bucketco/tracking-sdk";
// or
var bucket = require("@bucketco/tracking-sdk");
```

## Usage

```js
// init the script with your Tracking Key
bucket.init("tk123");

// set current user and company
bucket.user("john_doe", { name: "John Doe" });
bucket.company("acme_inc", { name: "Acme Inc", plan: "pro" });

// track events
bucket.track("sent_message", { foo: "bar" });
```

**NOTE**: See [server-side usage](#-server-side-without-persisting-user) if you're using the SDK in node.js

### Init options

Supply these to the `init` call (second argument)

```ts
{
  debug?: false, // enable debug mode to log all info and errors
  host?: "https://tracking.bucket.co", // probably don't need to change this
  persistUser?: true // see below under "server-side usage"
}
```

### Custom attributes

You can pass attributes as a object literal to the `user`, `company` and `track` methods (second argument).
Attributes cannot be nested (multiple levels) and must be either strings, integers or booleans.

### Server-side without persisting users

By default, once you call `user`, the userId will be persisted so you don't have to supply userId to each subsequent `company` and `track` calls.
This is practical for client-side usage where a session always is a single user.

If you're using the SDK server-side in node.js, you most likely don't want this behavior as that can lead to events tied to the wrong user by mistake.

In that case, you can disable it and then make sure to pass `userId` explicitly as the third argument to `company` and `track` calls, like so:

```
bucket.init("tk123", { persistUser: false });
bucket.user("john_doe");
bucket.company("acme_inc", null, "john_doe");
bucket.track("sent_message", { foo: "bar" }, "john_doe");
```

### Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

# License

MIT License

Copyright (c) 2022 Bucket ApS
