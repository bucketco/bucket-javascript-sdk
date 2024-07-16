# Bucket React SDK

React client side library for [Bucket.co](https://bucket.co)

## Install

Install via npm:

```
npm i @bucketco/react-sdk
```

## Setup

### 1. Define Flags (optional)

To get type safe feature flags, extend the definition of the `Flags` interface and define which flags you have.
See the example below for the details.

If no explicit flag definitions are provided, there will be no types checked flag lookups.

**Example:**

```tsx
// Define your flags by extending the `Flags` interface in @bucketco/react-sdk
declare module "@bucketco/react-sdk" {
  interface Flags {
    huddle: boolean;
    recordVideo: boolean;
  }
}
```

### 2. Add the `BucketProvider` context provider

Add the `BucketProvider` context provider to your application.
This will initialize the Bucket SDK, fetch feature flags and start listening for Live Satisfaction events.

**Example:**

```tsx
import { BucketProvider } from "@bucketco/react-sdk"

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  company={ id: "acme_inc" }
  user={ id: "john doe" }
  loadingComponent={<Loading />}
  fallbackFlags={["huddle"]}
>
{/* children here are shown when loading finishes or immediately if no `loadingComponent` is given */}
</BucketProvider>
```

- `publishableKey` is used to connect the provider to an _environment_ on Bucket. Find your `publishableKey` under `Activity` on https://app.bucket.co.
- `company`, `user` and `otherContext` make up the _context_ that is used to determine if a feature flag is enabled or not. `company` and `user` contexts are automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which flags etc.

  If you specify `company` and/or `user` they must have at least the `id` property plus anything additional you want to be able to evaluate flags against. See "Managing Bucket context" below.

- `fallbackFlags` is a list of strings which specify which flags to consider enabled if the SDK is unable to fetch flags.
- `loadingComponent` lets you specify an React component to be rendered instead of the children while the Bucket provider is initializing. If you want more control over loading screens, `useFlags()` returns `isLoading` which you can use to customize the loading experience:

  ```tsx
  function LoadingBucket({ children }) {
    const {isLoading} = useFlags()
    if (isLoading) {
      return <Spinner />
    }

    return children
  }

  //-- Initialize the Bucket provider
  <BucketProvider publishableKey={YOUR_PUBLISHABLE_KEY} /*...*/>
    <LoadingBucket>
    {/* children here are shown when loading finishes */}
    </LoadingBucket>
  <BucketProvider>
  ```

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

Returns all enabled feature flags as an object. Mostly useful for debugging and getting the current loading state.

```tsx
import { useFlags } from "@bucketco/react-sdk";

function DebugFlags() {
  const featureFlags = useFlags();
  // {
  //   "isLoading": false,
  //   "flags: {
  //     "join-huddle": true
  //     "post-message": true
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
  const [company, _] = useState(initialCompany);
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

### `useRequestFeedback()`

`useRequestFeedback()` returns a function that lets you open up a dialog to ask for feedback on a specific feature.
See [Live Satisfaction](https://docs.bucket.co/product-handbook/live-satisfaction) for how to do this automatically, without code.

```ts
import { useTrackEvent } from "@bucketco/react-sdk";

const requestFeedback = useRequestFeedback();

requestFeedback({
  featureId: "bucket-feature-id",
  title: "How satisfied are you with file uploads?",
});
```

See https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#manual-feedback-collection for more information on `requestFeedback`

### `useSendFeedback()`

`useSendFeedback()` returns a function that lets you send feedback to Bucket.
This is useful if you've manually collected feedback and want to send it to Bucket.

```ts
import { useSendFeedback } from "@bucketco/react-sdk";

const sendFeedback = useSendFeedback();

sendFeedback({
  featureId: "bucket-feature-id",
  score: 5,
  comment: "Best thing I"ve ever tried!",
});
```

See https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/tracking-sdk/FEEDBACK.md#manual-feedback-collection for more information on `sendFeedback`

# License

MIT License

Copyright (c) 2024 Bucket ApS
