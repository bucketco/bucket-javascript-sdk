# Bucket React SDK

React client side library for [Bucket.co](https://bucket.co)

## Install

Install via npm:

```
npm i @bucketco/react-sdk
```

## Setup

### 1. Define Features (optional)

To get type safe feature definitions, extend the definition of the `Features` interface and define which features you have.
See the example below for the details.

If no explicit feature definitions are provided, there will be no types checked feature lookups.

**Example:**

```tsx
// Define your features by extending the `Features` interface in @bucketco/react-sdk
declare module "@bucketco/react-sdk" {
  interface Features {
    huddle: boolean;
    recordVideo: boolean;
  }
}
```

### 2. Add the `BucketProvider` context provider

Add the `BucketProvider` context provider to your application.
This will initialize the Bucket SDK, fetch features and start listening for Live Satisfaction events.

**Example:**

```tsx
import { BucketProvider } from "@bucketco/react-sdk";

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  company={{ id: "acme_inc" }}
  user={{ id: "john doe" }}
  loadingComponent={<Loading />}
  fallbackFeatures={["huddle"]}
>
  {/* children here are shown when loading finishes or immediately if no `loadingComponent` is given */}
</BucketProvider>;
```

- `publishableKey` is used to connect the provider to an _environment_ on Bucket. Find your `publishableKey` under `Activity` on https://app.bucket.co.
- `company`, `user` and `otherContext` make up the _context_ that is used to determine if a feature is enabled or not. `company` and `user` contexts are automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which features etc.

  If you specify `company` and/or `user` they must have at least the `id` property plus anything additional you want to be able to evaluate feature targeting against. See "Managing Bucket context" below.

- `fallbackFeatures` is a list of strings which specify which features to consider enabled if the SDK is unable to fetch features.
- `loadingComponent` lets you specify an React component to be rendered instead of the children while the Bucket provider is initializing. If you want more control over loading screens, `useFeature()` returns `isLoading` which you can use to customize the loading experience:

  ```tsx
  function LoadingBucket({ children }) {
    const {isLoading} = useFeature("myFeature")
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

### `useFeature()`

Returns the state of a given features for the current context.

```tsx
import { useFeature } from "@bucketco/react-sdk";

function StartHuddleButton() {
  const { isLoading, isEnabled } = useFeature("huddle");

  if (isLoading) {
    return <Loading />;
  }

  if (!isEnabled) {
    return null;
  }

  return <Button />;
}
```

### `useTrack()`

`useTrack()` lets you send custom events to Bucket. Use this whenever a user _uses_ a feature. Create [features](https://docs.bucket.co/introduction/concepts/feature) in Bucket based off of these events to analyze feature usage.

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
