# Reflag React SDK

React client side library for [Reflag.com](https://bucket.co)

Reflag supports flag toggling. multi-variate flags, tracking usage and [requesting feedback](#userequestfeedback).

The Reflag React SDK comes with a [built-in toolbar](https://docs.bucket.co/supported-languages/browser-sdk#toolbar) which appears on `localhost` by default.

## Install

Install via npm:

```shell
npm i @reflag/react-sdk
```

## Get started

### 1. Add the `ReflagProvider` context provider

Add the `ReflagProvider` context provider to your application:

**Example:**

```tsx
import { ReflagProvider } from "@reflag/react-sdk";

<ReflagProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  company={{ id: "acme_inc", plan: "pro" }}
  user={{ id: "john doe" }}
  loadingComponent={<Loading />}
>
  {/* children here are shown when loading finishes or immediately if no `loadingComponent` is given */}
</ReflagProvider>;
```

### 2. Create a new flag and set up type safety

Install the Reflag CLI:

```shell
npm i --save-dev @reflag/cli
```

Run `npx reflag new` to create your first flag!
On the first run, it will sign into Reflag and set up type generation for your project:

```shell
❯ npx reflag new
Opened web browser to facilitate login: https://app.bucket.co/api/oauth/cli/authorize

Welcome to Reflag!

? Where should we generate the types? gen/flags.d.ts
? What is the output format? react
✔ Configuration created at reflag.config.json.

Creating flag for app Slick app.
? New flag name: Huddle
? New flag key: huddle
✔ Created flag Huddle with key huddle (https://app.bucket.co/features/huddles)
✔ Generated react types in gen/flags.d.ts.
```

> [!Note]
> By default, types will be generated in `gen/flags.d.ts`.
> The default `tsconfig.json` file `include`s this file by default, but if your `tsconfig.json` is different, make sure the file is covered in the `include` property.

### 3. Use `useFlag(<flagKey>)` to get flag value

Using the `useFlag` hook from your components lets you manage functionality in your app and track flag usage:

**Example:**

```tsx
function StartHuddleButton() {
  const isEnabled = useFlag("huddle"); // boolean indicating if the flag is enabled
  const track = useTrack("huddle"); // track usage of the feature

  if (!isEnabled) {
    return null;
  }

  return <button onClick={() => track()}>Start huddle!</button>;
}
```

`useFlag` can help you do much more. See a full example for `useFlag` [see below](#useflag).

## Setting `user` and `company`

Reflag determines which flags are active for a given `user`, `company`, or `otherContext`.
You pass these to the `ReflagProvider` as props.

If you supply `user` or `company` objects, they must include at least the `id` property otherwise they will be ignored in their entirety.
In addition to the `id`, you must also supply anything additional that you want to be able to evaluate flag targeting rules against.
Attributes which are not properties of the `user` or `company` can be supplied using the `otherContext` prop.

Attributes cannot be nested (multiple levels) and must be either strings, numbers or booleans.
A number of special attributes exist:

- `name` -- display name for `user`/`company`,
- `email` -- the email of the user,
- `avatar` -- the URL for `user`/`company` avatar image.

```tsx
<ReflagProvider
  publishableKey={YOUR_PUBLISHABLE_KEY}
  user={{ id: "user_123", name: "John Doe", email: "john@acme.com" }}
  company={{ id: "company_123", name: "Acme, Inc" }}
  otherContext={{ completedSteps: [1, 4, 7] }}
>
  <LoadingReflag>
    {/* children here are shown when loading finishes */}
  </LoadingReflag>
</ReflagProvider>
```

To retrieve flags along with their targeting information, use `useFlag(flagKey: FlagKey)` hook (described in a section below).

Note that accessing the value returned by `useFlag()` automatically generates a `check` event.

## Migrating from Bucket SDK

If you're migrating from the legacy Bucket SDK to Reflag SDK, here are the key changes you need to make:

### Provider Changes

- **`BucketProvider`** → **`ReflagProvider`**
- **`BucketClient`** → **`ReflagClient`**

### Hook changes

- **`useFeature()`** → **`useFlag()`**
- **`useTrack()`** → **`useTrackCustom()`** for custom events (not flag keys)
- **`useIsLoading()`** was added

**Important**: The new `useFlag()` hook returns the flag value directly (boolean or config object), not an object with methods. The methods that were previously returned by `useFeature()` are now available as separate hooks:

- **`useFeature().isEnabled`** → **`useFlag()`** (returns boolean for "toggle" flags)
- **`useFeature().config`** → **`useFlag()`** (returns object for "multi-variate" flags)
- **`useFeature().track`** → **`useTrack()`** (separate hook)
- **`useFeature().requestFeedback`** → **`useRequestFeedback()`** (separate hook)
- **`useFeature().isLoading`** → **`useIsLoading()`** (separate hook)

### Configuration changes

- **`fallbackFeatures`** → **`fallbackFlags`**

  ```tsx
  // Old (Bucket SDK)
  <BucketProvider
    fallbackFeatures={["feature1", "feature2"]}
    // or with configuration
    fallbackFeatures={{
      "feature1": true,
      "feature2": { key: "variant-a", payload: { limit: 100 } }
    }}
  >

  // New (Reflag SDK)
  <ReflagProvider
    fallbackFlags={{
      "flag1": true,
      "flag2": { key: "variant-a", payload: { limit: 100 } }
    }}
  >
  ```

### Type changes

- **`Feature`** → **`Flag`**
- **`Features`** → **`Flags`**
- **`FeatureKey`** → **`FlagKey`**
- **`TypedFeatures`** → **`TypedFlags`**

### Feedback changes

- **`featureKey`** → **`flagKey`** (in feedback requests)
- **`featureId`** was removed

### Hook event changes

- **`featuresUpdated`** → **`flagsUpdated`**
- **`enabledCheck`** → **`check`** (use the unified `check` event instead)
- **`configCheck`** → **`check`** (use the unified `check` event instead)

### Example migration

```tsx
// Old (Bucket SDK)
import { BucketProvider, useFeature } from "@bucket/react-sdk";

function MyComponent() {
  const { isEnabled, config, track } = useFeature("my-feature");

  return (
    <BucketProvider publishableKey="pk_..." fallbackFeatures={["my-feature"]}>
      {isEnabled && <button onClick={track}>Use Feature</button>}
    </BucketProvider>
  );
}

// New (Reflag SDK)
import {
  ReflagProvider,
  useFlag,
  useTrack,
  useRequestFeedback,
} from "@reflag/react-sdk";

function MyComponent() {
  const isEnabled = useFlag("my-flag");
  const track = useTrack("my-flag");
  const requestFeedback = useRequestFeedback("my-flag");

  return (
    <ReflagProvider publishableKey="pk_..." fallbackFlags={["my-flag"]}>
      {isEnabled && (
        <>
          <button onClick={() => track()}>Use Flag</button>
          <button
            onClick={() =>
              requestFeedback({
                title: "How do you like this feature?",
              })
            }
          >
            Give Feedback
          </button>
        </>
      )}
    </ReflagProvider>
  );
}
```

### Type definitions

Update your type definitions:

```typescript
// Old (Bucket SDK)
declare module "@bucket/react-sdk" {
  interface Features {
    "my-feature": boolean;
  }
}

// New (Reflag SDK)
declare module "@reflag/react-sdk" {
  interface Flags {
    "my-flag": boolean;
  }
}
```

## `<ReflagProvider>` component

The `<ReflagProvider>` initializes the Reflag SDK, fetches flags and starts listening for automated feedback survey events. The component can be configured using a number of props:

- `publishableKey` is used to connect the provider to an _environment_ on Reflag. Find your `publishableKey` under [environment settings](https://app.bucket.co/env-current/settings/app-environments) in Reflag,
- `company`, `user` and `otherContext` make up the _context_ that is used to determine if a flag is enabled or not. `company` and `user` contexts are automatically transmitted to Reflag servers so the Reflag app can show you which companies have access to which features, etc.

  > [!Note]
  > If you specify `company` and/or `user` they must have at least the `id` property, otherwise they will be ignored in their entirety. You should also supply anything additional you want to be able to evaluate flag targeting against,

- `fallbackFlags`: A list of strings which specify which flags to consider enabled if the SDK is unable to fetch flags:

  ```ts
  fallbackFlags: {
      "flag1": true,  // just enable a "toggle" flag
      "flag2": {      // specify the variant for a "multi-variate" flag
        key: "variant-a",
        payload: {
          limit: 100,
          mode: "test"
        }
      }
  }
  ```

- `timeoutMs`: Timeout in milliseconds when fetching flags from the server
- `staleWhileRevalidate`: If set to `true`, stale flags will be returned while refetching flags in the background
- `expireTimeMs`: If set, flags will be cached between page loads for this duration (in milliseconds)
- `staleTimeMs`: Maximum time (in milliseconds) that stale flags will be returned if `staleWhileRevalidate` is true and new flags cannot be fetched
- `offline`: Provide this option when testing or in local development environments to avoid contacting Reflag servers
- `loadingComponent` lets you specify an React component to be rendered instead of the children while the Reflag provider is initializing. If you want more control over loading screens, `useIsLoading()` returns `isLoading` which you can use to customize the loading experience:

  ```tsx
  function LoadingReflag({ children }) {
    const isLoading = useIsLoading();
    if (isLoading) {
      return <Spinner />;
    }

    return children;
  }

  //-- Initialize the Reflag provider
  <ReflagProvider publishableKey={YOUR_PUBLISHABLE_KEY} /*...*/>
    <LoadingReflag>
      {/* children here are shown when loading finishes */}
    </LoadingReflag>
  </ReflagProvider>;
  ```

- `enableTracking`: Set to `false` to stop sending tracking events and user/company updates to Reflag. Useful when you're impersonating a user (defaults to `true`),
- `apiBaseUrl`: Optional base URL for the Reflag API. Use this to override the default API endpoint,
- `appBaseUrl`: Optional base URL for the Reflag application. Use this to override the default app URL,
- `sseBaseUrl`: Optional base URL for Server-Sent Events. Use this to override the default SSE endpoint,
- `debug`: Set to `true` to enable debug logging to the console,
- `toolbar`: Optional [configuration](https://docs.bucket.co/supported-languages/browser-sdk/globals#toolbaroptions) for the Reflag toolbar,
- `feedback`: Optional configuration for feedback collection

## Hooks

### `useFlag()`

Returns the value of a given flag for the current context. The hook provides type-safe access to flag values and their configurations.
Returns `undefined` if the client is not ready yet.

For "toggle" flags, `useFlag()` returns `true`/`false`. For multi-variate flags, it returns an object of type `{ key: string, payload: TypeOfPayload }`.
A typical example (when accessing multi-variable flags):

```tsx
import { useFlag, useTrack, useRequestFeedback } from "@reflag/react-sdk";

function StartHuddleButton() {
  const { payload } = useFlag("huddle"); // the value of the flag
  const track = useTrack("huddle");
  const requestFeedback = useRequestFeedback("huddle");

  if (!isEnabled) {
    return null;
  }

  return (
    <>
      <button onClick={() => track()}>Start huddle!</button>
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

### `useIsLoading()`

Returns a boolean indicating whether flags are currently being loaded. This is useful for showing loading states while the SDK initializes.

```tsx
import { useIsLoading } from "@reflag/react-sdk";

function LoadingSpinner() {
  const isLoading = useIsLoading();

  if (isLoading) {
    return <div>Loading flags...</div>;
  }

  return null;
}
```

### `useTrack()`

`useTrack()` lets you send flag track events to Reflag. Use this whenever a user _uses_ a feature guarded by a flag:

```tsx
import { useTrack } from "@reflag/react-sdk";

function StartHuddle() {
  const track = useTrack("huddle");

  return (
    <div>
      <button onClick={() => track({ huddleType: "voice" })}>
        Start voice huddle!
      </button>
    </div>
  );
}
```

### `useTrackCustom()`

`useTrack()` lets you send custom events to Reflag. Use this whenever a user _uses_ a feature guarded by a flag:

```tsx
import { useTrackCustom } from "@reflag/react-sdk";

function StartHuddle() {
  const track = useTrackCustom("Huddle Started");

  return (
    <div>
      <button onClick={() => track({ huddleType: "voice" })}>
        Start voice huddle!
      </button>
    </div>
  );
}
```

### `useRequestFeedback()`

Returns a function that lets you open up a dialog to ask for feedback on a specific flag. This is useful for collecting
targeted feedback about specific features guarded by flags.

`useRequestFeedback()` returns a function that lets you open up a dialog to ask for feedback on a specific feature guarded by the flag.
See [Automated Feedback Surveys](https://docs.bucket.co/product-handbook/live-satisfaction) for how to do this automatically, without code.

The example below shows how to use `position` to ensure the popover appears next to the "Give feedback!" button:

```tsx
import { useRequestFeedback } from "@reflag/react-sdk";

function FeedbackButton() {
  const requestFeedback = useRequestFeedback("huddle-flag");
  return (
    <button
      onClick={(e) =>
        requestFeedback({
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

See the [Feedback Documentation](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/FEEDBACK.md#manual-feedback-collection)
for more information on `requestFeedback` options.

### `useSendFeedback()`

Returns a function that lets you send feedback to Reflag. This is useful if you've manually collected feedback through your own UI and want to send it to Reflag.

```tsx
import { useSendFeedback } from "@reflag/react-sdk";

function CustomFeedbackForm() {
  const sendFeedback = useSendFeedback("flag-key");

  const handleSubmit = async (data: FormData) => {
    await sendFeedback({
      score: parseInt(data.get("score") as string),
      comment: data.get("comment") as string,
    });
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

### `useUpdateUser()`, `useUpdateCompany()` and `useUpdateOtherContext()`

These hooks return functions that let you update the attributes for the currently set user, company, or other context. Updates to user/company
are stored remotely and affect flag targeting, while "other" context updates only affect the current session.

```tsx
import {
  useUpdateUser,
  useUpdateCompany,
  useUpdateOtherContext,
} from "@reflag/react-sdk";

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

Note: To change the `user.id` or `company.id`, you need to update the props passed to `ReflagProvider` instead of using these hooks.

### `useClient()`

Returns the `ReflagClient` used by the `ReflagProvider`. The client offers more functionality that
is not directly accessible thorough the other hooks.

```tsx
import { useClient } from "@reflag/react-sdk";

function LoggingWrapper({ children }: { children: ReactNode }) {
  const client = useClient();

  useEffect(() => {
    client.on("check", (evt) => {
      console.log(`The flag ${evt.key} is ${evt.value} for user.`);
    });
  }, [client]);

  return children;
}
```

## Content Security Policy (CSP)

See [CSP](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/README.md#content-security-policy-csp) for info on using Reflag React SDK with CSP

## License

MIT License

Copyright (c) 2025 Bucket ApS
