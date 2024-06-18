# Bucket React SDK

React client side library for [Bucket.co](https://bucket.co)

## Install

Install via npm:

```
npm i @bucketco/react-sdk
```

## Setup

Wrap your application with the `Bucket` higher order component.

This will initialize Bucket, fetch feature flags and start listening for Live Satisfaction events.

```tsx
import BucketProvider from "@bucketco/react-sdk";

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  context={{
    // The context should take the form of { user: { id }, company: { id } }
    // plus anything additional you want to be able to evaluate flags against.
    user: { id: "john_doe" },
    company: { id: "acme_inc" },
  }}
>
  {/* ... */}
</BucketProvider>
```

### Props

All options which can be passed to `bucket.init` can be passed as props to the Bucket higher order component.

See the [Tracking SDK documentation](../tracking-sdk/README.md) for more.

```tsx
import BucketProvider from "@bucketco/react-sdk";

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}" // The publishable key of your app environment
  debug={false} // Enable debug mode to log info and errors
  persistUser={true} // See the Tracking SDK documentation under "Persisting Users"
  host="https://tracking.bucket.co" // Configure the host Bucket calls are made to
  sseHost="https://livemessaging.bucket.co" // Configure the host Bucket SSE calls are made to
  feedback={{
    // See feedback options here: https://github.com/bucketco/bucket-tracking-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#global-feedback-configuration
  }}
>
  {/* ... */}
</BucketProvider>
```

## Hooks

### `useBucket()`

Returns the instance of the Bucket Tracking SDK in use. This can be used to make calls to Bucket, including `track` and `feedback` calls, e.g.

```ts
import { useBucket } from "@bucketco/react-sdk";

const bucket = useBucket();

bucket.track("sent_message", { foo: "bar" }, "john_doe", "company_id");
```

See the [Tracking SDK documentation](../tracking-sdk/README.md) for usage information.

### `useFeatureFlag()`

Returns the state of a given feature flag for the current context, e.g.

```ts
import { useFeatureFlag } from "@bucketco/react-sdk";

const joinHuddleFlag = useFeatureFlag("join-huddle");
// {
//   "isLoading": false,
//   "value": true,
// }
```

### `useFeatureFlags()`

Returns feature flags as an object, e.g.

```ts
import { useFeatureFlags } from "@bucketco/react-sdk";

const featureFlags = useFeatureFlags();
// {
//   "isLoading": false,
//   "flags: {
//     "join-huddle": {
//       "key": "join-huddle",
//       "value": true
//     },
//     "post-message": {
//       "key": "post-message",
//       "value": true
//     }
//   }
// }
```

# License

MIT License

Copyright (c) 2024 Bucket ApS
