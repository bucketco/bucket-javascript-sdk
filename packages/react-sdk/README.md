# Bucket React SDK

React client side library for [Bucket.co](https://bucket.co)

## Install

Install via npm:

```
npm i @bucketco/react-sdk
```

## Setup

To get type safe feature flags, create a `const` object that defines which flags you have
and create a new `BucketProvider` context provider type using your flags object.

Then wrap your application with the `BucketProvider` context provider.
This will initialize the Bucket SDK, fetch feature flags and start listening for Live Satisfaction events.

The `BucketProvider` will [suspense](https://react.dev/reference/react/Suspense) while loading so any subsequent uses of feature flags are instant.

See `useFeatureFlag()` below for more fine-grained control over loading indicators.

**Example:**

```tsx
import { TypedBucket } from "@bucketco/react-sdk";

// Define your flags like so.
// The boolean value indicates if flags should default to on or off in case
// we can't reach bucket.co or if they don't exist on bucket.co
const flags = {
  huddle: true,
  recordVideo: false,
};

const MyBucket = TypedBucket(flags);
export const { useFlag, useFlags, useRequestFeedback } = MyBucket;

// create a typed provider
type MyBucket = BucketProvider<flags>;

//--- Initialize the BucketProvider
<Suspense fallback={<Loading />}>
  <MyBucket.Provider
    publishableKey="{YOUR_PUBLISHABLE_KEY}" // The publishable key of your app environment
    // `company` and `user` should have at least the `id` property plus anything additional you want to be able to evaluate flags against.
    // if `company` or `user` isn't given, BucketProvider will pull it from `localstorage`.
    // see "Managing Bucket context" below.
    company={ id: "acme_inc" }
    user={ id: "john doe" }
    // TODO: should you be able to initialize without giving a context? In that case you must `useUpdateContext` later.
    // situationalContext={....}
    {/* ... */}
  </MyBucket.Provider>;
</Suspense>
```

The context you provide is automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which flags etc.

If you're not yet using `<Suspense>` you can achieve a similar thing by doing:

```tsx
function LoadingBucket({ children }) {
  const {isLoading} = useFeatureFlags()
  if (isLoading) {
    return <Spinner />
  }

  return children
}

//-- Initialize the Bucket provider
<MyBucket.Provider publishableKey={YOUR_PUBLISHABLE_KEY} /*...*/>
  <LoadingBucket>
   {/* ... */}
   </LoadingBucket>
<MyBucket.Provider>
```

### Options

TODO: Describe options to `BucketProvider`

<!-- All options which can be passed to `bucket.init` can be passed as props to the Bucket higher order component.

See the [Tracking SDK documentation](../tracking-sdk/README.md) for more.

```tsx
import { BucketProvider } from "@bucketco/react-sdk";

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}" // The publishable key of your app environment
  debug={false} // Enable debug mode to log info and errors
  host="https://tracking.bucket.co" // Configure the host Bucket calls are made to
  sseHost="https://livemessaging.bucket.co" // Configure the host Bucket SSE calls are made to
  feedback={
    {
      // See feedback options here: https://github.com/bucketco/bucket-tracking-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#global-feedback-configuration
    }
  }
>
  {/* ... */}
</BucketProvider>;
``` -->

# Managing Bucket context

It's often then case that you don't want to carry around _all_ the Bucket context required to evaluate feature flags everywhere. You might only have this context at log-in time or similar.

You can manage that by calling the functions returned from `useUpdateContext()` to update `user` or `company` objects. These are saved in localstorage and the new flags will be fetched immediately.

TODO: How can we work with context better?

## Components

### `<FlagEnabled>`

> TODO: Alternative naming: `FlagGate`

Simple gate that only renders the children if the feature flag is enabled. See `hooks` below for use cases beyond the very basic stuff.

If you used a typed provider as described in [Setup](#setup), your flag will be type checked.

```typescript
import { FlagEnabled } from "@bucketco/react-sdk";

<FlagEnabled flag={"HUDDLE"}>
  <Button>Huddle time!</Button>
</FlagEnabled>
```

## Hooks

### `useFlagIsEnabled()`

Returns a boolean indicating if the given feature flag is enabled for the current context.
If not using a <Suspense> barrier, `useFlagIsEnabled` returns false while flags are being loaded.

Use `useFeatureFlag()` for fine-grained control over loading and rendering.

```ts
import { useFeatureFlag } from "@bucketco/react-sdk";

const joinHuddleFlagEnabled = useFlagIsEnabled("huddle");
// true
```

### `useFeatureFlag()`

Returns the state of a given feature flag for the current context.

```ts
import { useFeatureFlag } from "@bucketco/react-sdk";

const { isLoading, isEnabled } = useFeatureFlag("huddle");
```

### `useFeatureFlags()`

TODO: remove? when do you need this?
Returns feature flags as an object, e.g.

```ts
import { useFeatureFlags } from "@bucketco/react-sdk";

const featureFlags = useFeatureFlags();
// {
//   "isLoading": false,
//   "flags: {
//     "join-huddle": true
//     "post-message": false
//   }
// }
```

### `useUpdateContext()`

`useUpdateContext` returns a set of functions that can be used to update the stored Bucket context.
This causes the Bucket client to refetch feature flags.

TODO: Do you sometimes need to use `useUpdateContext` outside of the context provider? How'll that work?

```ts
import { useUpdateContext } from "@bucketco/react-sdk";

const { updateUser, updateCompany, updateSituationalContext } =
  useUpdateContext();

updateUser({
  id: "jane_doe",
  role: "manager",
});

updateCompany({
  id: "jane_doe",
  role: "manager",
});

updateSituationalContext({
  happeningId: "bigConference,
});
```

### `useTrackFeature()`

`useTrackFeature()` returns a function you can use to track feature usage.

```ts
import { useTrackFeature } from "@bucketco/react-sdk";

const trackFeature = useTrackFeature();

trackFeature("feature_key");
```

### `useTrack()`

`useTrack()` lets you send events to Bucket.

```ts
import { useTrackEvent } from "@bucketco/react-sdk";

const trackEvent = useTrackEvent();

track("sent_message", { foo: "bar" });
```

See the [Tracking SDK documentation](../tracking-sdk/README.md) for usage information.

# License

MIT License

Copyright (c) 2024 Bucket ApS
