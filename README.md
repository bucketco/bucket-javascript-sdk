# Bucket Tracking SDK

Isomorphic JS/TS tracking agent for [Bucket.co](https://bucket.co)

## Install

The library can be included directly as an external script or you can import it. UMD and ES modules are supported.

A. Script tag (client-side usage)

```html
<script src="https://cdn.bucket.co/tracking-sdk.v1.js"></script>
```

B. Import module (either in node or browser bundling)

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

Enabling debugging prints helpful console messages

```js
bucket.init("tk123", { debug: true });
```

## Typescript

Types are bundled together with the library and exposed automatically when importing through a package manager.

# License

MIT License

Copyright (c) 2022 Bucket ApS
