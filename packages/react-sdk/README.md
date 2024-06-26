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

**Example:**

Create a file called `bucket.ts`:

```tsx
import { TypedBucket } from "@bucketco/react-sdk";

// Define your flags like so.
// The boolean value indicates if flags should default to on or off in case
// we can't reach bucket.co or if they don't exist on bucket.co
const flags = {
  huddle: true,
  recordVideo: false,
};

export const MyBucket = TypedBucket(flags);
export const {
  useFlag,
  useFlags,
  useRequestFeedback,
  useCompany,
  useUser,
  useOtherContext,
  useTrack,
} = MyBucket;
```

And update your `App.tsx` to insert the `<MyBucket.Provider />` so it looks something like the following:

```tsx
import { MyBucket } from 'flags'

// Initialize the BucketProvider
<MyBucket.Provider
  publishableKey="{YOUR_PUBLISHABLE_KEY}" // The publishable key of your app environment
  // `company` and `user` should have at least the `id` property plus anything additional you want to be able to evaluate flags against.
  // See "Managing Bucket context" below.
  company={ id: "acme_inc" }
  user={ id: "john doe" }
  loading={<Loading />}
>
{/* ... */}
</MyBucket.Provider>
```

- `publishableKey` is used to connect the provider to an _environment_ on Bucket. Find your `publishableKey` under `Activity` on https://app.bucket.co.
- `company`, `user` and `otherContext` make up the _context_ that is used to determine if a feature flag is enabled or not. `company` and `user` contexts are automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which flags etc.
- `loading` lets you specify an alternative React component to be rendered while the Bucket provider is initializing. If you want more control over loading screens, `useFlags()` returns `isLoading` which you can use to customize the loading experience:

```tsx
function LoadingBucket({ children }) {
  const {isLoading} = useFlags()
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

## Hooks

### `useFlagIsEnabled()`

Returns a boolean indicating if the given feature flag is enabled for the current context.
`useFlagIsEnabled` returns false while flags are being loaded.

Use `useFlag()` for fine-grained control over loading and rendering.

```tsx
import { useFlagIsEnabled } from "@bucketco/react-sdk";

function StartHuddleButton() {
  const joinHuddleFlagEnabled = useFlagIsEnabled("huddle");
  // true / false

  if (!joinHuddleFlagEnabled) {
    return null;
  }

  return <Button />;
}
```

### `useFlag()`

Returns the state of a given feature flag for the current context.

```tsx
import { useFlag } from "@bucketco/react-sdk";

function StartHuddleButton() {
  const { isLoading, isEnabled } = useFlag("huddle");

  if (isLoading) {
    return <Loading />;
  }

  if (!isEnabled) {
    return null;
  }

  return <Button />;
}
```

### `useFlags()`

Returns all enabled feature flags as an object. Useful for debugging or checking many flags at the same time.

```tsx
import { useFlags } from "@bucketco/react-sdk";

function DebugFlags() {
  const featureFlags = useFlags();
  // {
  //   "isLoading": false,
  //   "flags: {
  //     "join-huddle": true
  //     "post-message": false
  //   }
  // }

  if (featureFlags.isLoading) {
    return <Loading />;
  }

  return <pre>{JSON.stringify(featureFlags.flags)}</pre>;
}
```

### `useUpdateContext()`

`useUpdateContext` returns functions `updateCompany`, `updateUser` and `updateOtherContext`. The functions lets you update the _context_ that is used to determine if a feature flag is enabled or not. For example, if the user logs out, changes company or similar or a specific property changes on the company as in the example below:

```tsx
import { useUpdateContext } from "@bucketco/react-sdk";

function Company() {
  const { updateCompany } = useUpdateContext();
  return (
    <div>
      <button onClick={() => updateCompany({ ...company, plan: "enterprise" })}>
        Upgrade to enterprise
      </button>
    </div>
  );
}
```

### `useContext()`

`useContext` returns the `company`, `user` and `otherContext` currently set. This is mostly useful for debugging.

```tsx
import { useContext } from "@bucketco/react-sdk";

function FlagsContext() {
  const context = useContext();
  return (
    <div>
      <pre>{JSON.stringify(context)}</pre>
    </div>
  );
}
```

### `useTrack()`

`useTrack()` lets you send events to Bucket. Use this whenever a user _uses_ a feature. Create [features](https://docs.bucket.co/introduction/concepts/feature) in Bucket based off of these events to analyze feature usage.

```tsx
import { useTrack } from "@bucketco/react-sdk";

function StartHuddle() {
  const track = useTrack();
  return (
    <div>
      <button onClick={() => track("Huddle Started", { huddleType: "voice" })}>
        Start voice huddle!
      </button>
    </div>
  );
}
```

<!-- ### `useRequestFeedback()`

`useRequestFeedback()` returns a function that lets you open up a dialog to ask for feedback on a specific feature.
See [Live Satisfaction](https://docs.bucket.co/product-handbook/live-satisfaction) for how to do this automatically, without code.

```ts
import { useTrackEvent } from "@bucketco/react-sdk";

const requestFeedback = useRequestFeedback();

useRequestFeedback....("sent_message", { foo: "bar" });
```

### `useSendFeedback()`

`useSendFeedback()` returns a function that lets you send feedback to Bucket.
This is useful if you've manually collected feedback and want to send it to Bucket.

```ts
import { useTrackEvent } from "@bucketco/react-sdk";

const trackEvent = useTrack();

track("sent_message", { foo: "bar" });
```

See the [Tracking SDK documentation](../tracking-sdk/README.md) for usage information. -->

# License

MIT License

Copyright (c) 2024 Bucket ApS
