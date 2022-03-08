# Bucket Tracking SDK

Isomorphic JS/TS tracking agent for [Bucket.co](https://bucket.co)

## Quick start

1. Include script (client-side usage)

```html
<script src="https://cdn.bucket.co/tracking-sdk.v1.js"></script>
```

2. Import (either in node or browser bundling)

```js
import bucket from "@bucketco/tracking-sdk";
```

## Usage

```js
// init the script with your Tracking Key
bucket.init("tk123");

// set current user and company
bucket.user("john_doe", { name: "John Doe" });
bucket.company("acme_inc", { name: "Acme Inc" });

// track events
bucket.track("sent_message", { foo: "bar" });
```

## Debug

```js
bucket.init("tk123", { debug: true });
```

## Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.
