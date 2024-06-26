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

See `useFlag()` below for more fine-grained control over loading indicators.

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
import { MyBucket} from 'flags'

// Initialize the BucketProvider
<Suspense fallback={<Loading />}>
  <MyBucket.Provider
    publishableKey="{YOUR_PUBLISHABLE_KEY}" // The publishable key of your app environment
    // `company` and `user` should have at least the `id` property plus anything additional you want to be able to evaluate flags against.
    // See "Managing Bucket context" below.
    company={ id: "acme_inc" }
    user={ id: "john doe" }
  >
  {/* ... */}
  </MyBucket.Provider>
</Suspense>
```

The context you provide is automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which flags etc.

If you're not yet using `<Suspense>` you can achieve a similar thing by doing:

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
If not using a <Suspense> barrier, `useFlagIsEnabled` returns false while flags are being loaded.

Use `useFlag()` for fine-grained control over loading and rendering.

```tsx
import { useFlag } from "@bucketco/react-sdk";

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

### `useCompany()`

`useCompany` returns `[company, setCompany()]`, similar to `useState`. Company is the current `company` object, while `setCompany` lets you update it.
Updates causes the Bucket client to refetch feature flags.

```tsx
import { useCompany } from "@bucketco/react-sdk";

function Company() {
  const [company, setCompany] = useCompany();

  const [name, setName] = useState(company.name);
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => setCompany({ ...company, name })}>
        Update company name
      </button>
    </div>
  );
}
```

### `useUser()`

`useUser` returns `[user, setUser()]`, similar to `useState`. Company is the current `user` object, while `setUser` lets you update it.
Updates causes the Bucket client to refetch feature flags.

```tsx
import { useUser } from "@bucketco/react-sdk";

function User() {
  const [user, setUser] = useUser();

  const [name, setName] = useState(user.name);
  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => setUser({ ...user, name })}>
        Update user name
      </button>
    </div>
  );
}
```

### `useOtherContext()`

`useOtherContext` returns `[otherContext, setOtherContext()]`, similar to `useState`. Company is the current `otherContext` object, while `setOtherContext` lets you update it.
Updates causes the Bucket client to refetch feature flags.

```tsx
import { useOtherContext } from "@bucketco/react-sdk";

function User() {
  const [otherContext, setOtherContext] = useOtherContext();

  const [happeningId, setHappeningId] = useState(otherContext.happeningId);
  return (
    <div>
      <input
        value={happeningId}
        onChange={(e) => setHappeningId(e.target.value)}
      />
      <button onClick={() => setOtherContext({ happeningId })}>
        Update happening ID
      </button>
    </div>
  );
}
```

### `useTrack()`

`useTrack()` lets you send events to Bucket. Use this whenever a user _uses_ a feature. Create [features](https://docs.bucket.co/introduction/concepts/feature) in Bucket based off of these events to analyse feature usage.

```ts
import { useTrack } from "@bucketco/react-sdk";

const track = useTrack();

track("Huddle Started", { huddleType: "voice" });
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
