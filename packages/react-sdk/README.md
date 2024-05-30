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
<Bucket publishableKey="{YOUR_PUBLISHABLE_KEY}">{/* ... */}</Bucket>
```

### Props

All options which can be passed to `bucket.init` can be passed as props to the Bucket higher order component.

```tsx
<Bucket
  publishableKey="{YOUR_PUBLISHABLE_KEY}" // The publishable key of your app environment
  debug={false} // Enable debug mode to log info and errors
  persistUser={true} // See the Tracking SDK documentation under "Persisting Users"
  host="https://tracking.bucket.co" // Configure the host Bucket calls are made to
  sseHost="https://livemessaging.bucket.co" // Configure the host Bucket sse calls are made to
  feedback={{
    // See feedback options here: https://github.com/bucketco/bucket-tracking-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#global-feedback-configuration
  }}
>
```

## Hooks

### `useBucket()`

Returns the instance of the Bucket Tracking SDK in use. This can be used to make calls to Bucket, including `track` and `feedback` calls, e.g.

```ts
const bucket = useBucket();

bucket.track("sent_message", { foo: "bar" }, "john_doe", "company_id");
```

See the [Tracking SDK documentation](../tracking-sdk/README.md) for usage information.

### `useFeatureFlag()`

Returns the state of a given feature flag for the current context, e.g.

```ts
const joinHuddleFlag = useFeatureFlag("join-huddle");
// {
//   "isLoading": false,
//   "value": true,
// }
```

### `useFeatureFlags()`

Returns feature flags as an object, e.g.

```ts
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
