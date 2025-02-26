# Bucket React SDK

React client side library for [Bucket.co](https://bucket.co)

Bucket supports feature toggling, tracking feature usage, [requesting feedback](#userequestfeedback) on features, and [remotely configuring features](#remote-config-beta).

## Install

Install via npm:

```shell
npm i @bucketco/react-sdk
```

## Get started

### 1. Define Features (optional)

To get type safe feature definitions, extend the definition of the `Features` interface and define which features you have.
See the example below for the details.

If no explicit feature definitions are provided, there will be no types checked feature lookups.

**Example:**

```typescript
import "@bucketco/react-sdk";

// Define your features by extending the `Features` interface in @bucketco/react-sdk
declare module "@bucketco/react-sdk" {
  interface Features {
    huddle: boolean;
    recordVideo: boolean;
  }
}
```

### 2. Add the `BucketProvider` context provider

Add the `BucketProvider` context provider to your application:

**Example:**

```tsx
import { BucketProvider } from "@bucketco/react-sdk";

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  company={{ id: "acme_inc", plan: "pro" }}
  user={{ id: "john doe" }}
  loadingComponent={<Loading />}
>
  {/* children here are shown when loading finishes or immediately if no `loadingComponent` is given */}
</BucketProvider>;
```

### 3. Use `useFeature(<featureKey>)` to get feature status

Using the `useFeature` hook from your components lets you toggle features on/off and track feature usage:

**Example:**

```tsx
function StartHuddleButton() {
  const {
    isEnabled, // boolean indicating if the feature is enabled
    track, // track usage of the feature
  } = useFeature("huddle");

  if (!isEnabled) {
    return null;
  }

  return <button onClick={track}>Start huddle!</button>;
}
```

`useFeature` can help you do much more. See a full example for `useFeature` [see below](#usefeature).

## Setting `user` and `company`

Bucket determines which features are active for a given `user`, `company`, or `otherContext`.
You pass these to the `BucketProvider` as props.

If you supply `user` or `company` objects, they must include at least the `id` property otherwise they will be ignored in their entirety.
In addition to the `id`, you must also supply anything additional that you want to be able to evaluate feature targeting rules against.
Attributes which are not properties of the `user` or `company` can be supplied using the `otherContext` prop.

Attributes cannot be nested (multiple levels) and must be either strings, numbers or booleans.
A number of special attributes exist:

- `name` -- display name for `user`/`company`,
- `email` -- the email of the user,
- `avatar` -- the URL for `user`/`company` avatar image.

```tsx
 <BucketProvider
    publishableKey={YOUR_PUBLISHABLE_KEY}
    user={{ id: "user_123", name: "John Doe", email: "john@acme.com" }}
    company={{ id: "company_123", name: "Acme, Inc" }}
    otherContext={{ completedSteps: [1, 4, 7] }}
  >
    <LoadingBucket>
    {/* children here are shown when loading finishes */}
    </LoadingBucket>
  <BucketProvider>
```

To retrieve features along with their targeting information, use `useFeature(key: string)` hook (described in a section below).

Note that accessing `isEnabled` on the object returned by `useFeature()` automatically
generates a `check` event.

## Remote config (beta)

In addition to toggling features on/off, Bucket supports remote configuration of features through Remote config.

Similar to `isEnabled`, each feature accessed using the `useFeature()` hook, has a `config` property. This configuration is managed from within Bucket. It is managed similar to the way access to features is managed, but instead of the
binary `isEnabled` you can have multiple configuration values which are given to different user/companies.

### Get started with Remote config

1. Update your feature definitions:

```typescript
import "@bucketco/react-sdk";

// Define your features by extending the `Features` interface in @bucketco/react-sdk
declare module "@bucketco/react-sdk" {
  interface Features {
    huddle: {
      // change from `boolean` to an object which sets
      // a type for the remote config for `questionnaire`
      maxTokens: number;
      model: string;
    };
  }
}
```

```ts
const {
  isEnabled,
  config: { key, payload },
} = useFeature("huddles");

// isEnabled: true,
// key: "gpt-3.5",
// payload: { maxTokens: 10000, model: "gpt-3.5-beta1" }
```

The `key` is always present while the `payload` is a optional JSON value for arbitrary configuration needs.
If a feature has no configuration or no configuration value was matched against the context, the config object will be empty.
Thus, `key` will be `undefined`. Make sure to check against this case when trying to use the
configuration in your application.

Note that, similar to `isEnabled`, accessing `config` on the object returned by `useFeature()` automatically
generates a `check` event.

## `<BucketProvider>` component

The `<BucketProvider>` initializes the Bucket SDK, fetches features and starts listening for automated feedback survey events. The component can be configured using a number of props:

- `publishableKey` is used to connect the provider to an _environment_ on Bucket. Find your `publishableKey` under [environment settings](https://app.bucket.co/envs/current/settings/app-environments) in Bucket,
- `company`, `user` and `otherContext` make up the _context_ that is used to determine if a feature is enabled or not. `company` and `user` contexts are automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which features etc.
  > [!Note]
  > If you specify `company` and/or `user` they must have at least the `id` property, otherwise they will be ignored in their entirety. You should also supply anything additional you want to be able to evaluate feature targeting against,
- `fallbackFeatures`: A list of strings which specify which features to consider enabled if the SDK is unable to fetch features. Can be provided in two formats:

  ```ts
  // Simple array of feature keys
  fallbackFeatures={["feature1", "feature2"]}

  // Or with configuration overrides
  fallbackFeatures: {
      "feature1": true,  // just enable the feature
      "feature2": {      // enable with configuration
        key: "variant-a",
        payload: {
          limit: 100,
          mode: "test"
        }
      }
  }
  ```

- `timeoutMs`: Timeout in milliseconds when fetching features from the server,
- `staleWhileRevalidate`: If set to `true`, stale features will be returned while refetching features in the background,
- `expireTimeMs`: If set, features will be cached between page loads for this duration (in milliseconds),
- `staleTimeMs`: Maximum time (in milliseconds) that stale features will be returned if `staleWhileRevalidate` is true and new features cannot be fetched.
- `loadingComponent` lets you specify an React component to be rendered instead of the children while the Bucket provider is initializing. If you want more control over loading screens, `useFeature()` returns `isLoading` which you can use to customize the loading experience:

  ```tsx
  function LoadingBucket({ children }) {
    const { isLoading } = useFeature("myFeature")
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

- `enableTracking`: Set to `false` to stop sending tracking events and user/company updates to Bucket. Useful when you're impersonating a user (defaults to `true`),
- `apiBaseUrl`: Optional base URL for the Bucket API. Use this to override the default API endpoint,
- `appBaseUrl`: Optional base URL for the Bucket application. Use this to override the default app URL,
- `sseBaseUrl`: Optional base URL for Server-Sent Events. Use this to override the default SSE endpoint,
- `debug`: Set to `true` to enable debug logging to the console,
- `toolbar`: Optional configuration for the Bucket toolbar,
- `feedback`: Optional configuration for feedback collection

## Hooks

### `useFeature()`

Returns the state of a given feature for the current context. The hook provides type-safe access to feature flags and their configurations.

```tsx
import { useFeature } from "@bucketco/react-sdk";

function StartHuddleButton() {
  const {
    isLoading, // true while features are being loaded
    isEnabled, // boolean indicating if the feature is enabled
    config: {
      // feature configuration
      key, // string identifier for the config variant
      payload, // type-safe configuration object
    },
    track, // function to track feature usage
    requestFeedback, // function to request feedback for this feature
  } = useFeature("huddle");

  if (isLoading) {
    return <Loading />;
  }

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <button onClick={track}>Start huddle!</button>
      <button
        onClick={(e) =>
          requestFeedback({
            title: payload?.question ?? "How do you like the Huddles feature?",
            position: {
              type: "POPOVER",
              anchor: e.currentTarget as HTMLElement,
            },
          })
        }
      >
        Give feedback!
      </button>
    </>
  );
}
```

### `useTrack()`

`useTrack()` lets you send custom events to Bucket. Use this whenever a user _uses_ a feature. Create [features](https://docs.bucket.co/introduction/concepts/feature) in Bucket based off of these events to analyze feature usage.
Returns a function to send custom events to Bucket. Use this whenever a user _uses_ a feature. These events can be used to analyze feature usage and create new features in Bucket.

```tsx
import { useTrack } from "@bucketco/react-sdk";

function StartHuddle() {
  <div>
    <button onClick={() => track("Huddle Started", { huddleType: "voice" })}>
      Start voice huddle!
    </button>
  </div>;
}
```

### `useRequestFeedback()`

Returns a function that lets you open up a dialog to ask for feedback on a specific feature. This is useful for collecting targeted feedback about specific features.

`useRequestFeedback()` returns a function that lets you open up a dialog to ask for feedback on a specific feature.
See [Automated Feedback Surveys](https://docs.bucket.co/product-handbook/live-satisfaction) for how to do this automatically, without code.

When using the `useRequestFeedback` you must pass the feature key to `requestFeedback`.
The example below shows how to use `position` to ensure the popover appears next to the "Give feedback!" button.

```tsx
import { useRequestFeedback } from "@bucketco/react-sdk";

function FeedbackButton() {
  const requestFeedback = useRequestFeedback();
  return (
    <button
      onClick={(e) =>
        requestFeedback({
          featureKey: "huddle-feature",
          title: "How satisfied are you with file uploads?",
          position: {
            type: "POPOVER",
            anchor: e.currentTarget as HTMLElement,
          },
          // Optional custom styling
          style: {
            theme: "light",
            primaryColor: "#007AFF",
          },
        })
      }
    >
      Give feedback!
    </button>
  );
}
```

See the [Feedback Documentation](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/FEEDBACK.md#manual-feedback-collection) for more information on `requestFeedback` options.

### `useSendFeedback()`

Returns a function that lets you send feedback to Bucket. This is useful if you've manually collected feedback through your own UI and want to send it to Bucket.

```tsx
import { useSendFeedback } from "@bucketco/react-sdk";

function CustomFeedbackForm() {
  const sendFeedback = useSendFeedback();

  const handleSubmit = async (data: FormData) => {
    await sendFeedback({
      featureId: "bucket-feature-id",
      score: parseInt(data.get("score") as string),
      comment: data.get("comment") as string,
      metadata: {
        source: "custom-form",
        userRole: "admin",
      },
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### `useUpdateUser()`, `useUpdateCompany()` and `useUpdateOtherContext()`

These hooks return functions that let you update the attributes for the currently set user, company, or other context. Updates to user/company are stored remotely and affect feature targeting, while "other" context updates only affect the current session.

```tsx
import {
  useUpdateUser,
  useUpdateCompany,
  useUpdateOtherContext,
} from "@bucketco/react-sdk";

function FeatureOptIn() {
  const updateUser = useUpdateUser();
  const updateCompany = useUpdateCompany();
  const updateOtherContext = useUpdateOtherContext();

  const handleUserUpdate = async () => {
    await updateUser({
      role: "admin",
      betaFeatures: "enabled",
    });
  };

  const handleCompanyUpdate = async () => {
    await updateCompany({
      plan: "enterprise",
      employees: 500,
    });
  };

  const handleContextUpdate = async () => {
    await updateOtherContext({
      currentWorkspace: "workspace-123",
      theme: "dark",
    });
  };

  return (
    <div>
      <button onClick={handleUserUpdate}>Update User</button>
      <button onClick={handleCompanyUpdate}>Update Company</button>
      <button onClick={handleContextUpdate}>Update Context</button>
    </div>
  );
}
```

Note: To change the `user.id` or `company.id`, you need to update the props passed to `BucketProvider` instead of using these hooks.

### `useClient()`

Returns the `BucketClient` used by the `BucketProvider`. The client offers more functionality that
is not directly accessible thorough the other hooks.

```tsx
import { useClient } from "@bucketco/react-sdk";

function LoggingWrapper({ children }: { children: ReactNode }) {
  const client = useClient();

  useEffect(() => {
    client.on("enabledCheck", (evt) => {
      console.log(`The feature ${evt.key} is ${evt.value} for user.`);
    });
  }, [client]);

  return children;
}
```

## Content Security Policy (CSP)

See [CSP](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/README.md#content-security-policy-csp) for info on using Bucket React SDK with CSP

## License

MIT License

Copyright (c) 2025 Bucket ApS
