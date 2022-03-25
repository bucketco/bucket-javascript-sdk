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

## Usage

```js
// init the script with your Tracking Key
bucket.init("tk123", {});

// set current user
bucket.user("john_doe", { name: "John Doe" });

// set current company
bucket.company("acme_inc", { name: "Acme Inc", plan: "pro" }, "john_doe");

// track events
bucket.track("sent_message", { foo: "bar" }, "john_doe");
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

### Custom attributes

You can pass attributes as a object literal to the `user`, `company` and `track` methods (2nd argument).
Attributes cannot be nested (multiple levels) and must be either strings, integers or booleans.

### Persisting users

**Usage in the browser** (imported or script tag):  
Once you call `user`, the userId will be persisted so you don't have to supply userId to each subsequent `company` and `track` calls.
This is practical for client-side usage where a session always is a single user.

**Usage in node.js**  
This is disabled by default when imported in node.js to avoid that companies or events are tied to the wrong user by mistake. This is because your server is (usually) not in a single user context.
Instead, you should provide the userId to each call, as the 3rd argument to `company` and `track`.

### Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

# License

MIT License

Copyright (c) 2022 Bucket ApS
