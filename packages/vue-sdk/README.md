# Reflag Vue SDK

Vue client side library for [Reflag.com](https://bucket.co)

Reflag supports flag toggling, multi-variate flags, tracking usage and [requesting feedback](#userequestfeedback).
The Reflag Vue SDK comes with a [built-in toolbar](https://docs.bucket.co/supported-languages/browser-sdk#toolbar) which appears on `localhost` by default.

## Install

Install via npm:

```shell
npm i @reflag/vue-sdk
```

## Get started

### 1. Wrap your application with the `ReflagProvider`

```vue
<script setup lang="ts">
import { ReflagProvider } from "@reflag/vue-sdk";
</script>

<ReflagProvider
  :publishable-key="publishableKey"
  :user="{ id: 'user_123', name: 'John Doe', email: 'john@acme.com' }"
  :company="{ id: 'acme_inc', plan: 'pro' }"
>
  <!-- your app -->
</ReflagProvider>
```

If using Nuxt, wrap `<ReflagProvider>` in `<ClientOnly>`. `<ReflagProvider>` only renders client-side currently.

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
? What is the output format? vue
✔ Configuration created at reflag.config.json.

Creating flag for app Slick app.
? New flag name: Huddle
? New flag key: huddle
✔ Created flag Huddle with key huddle (https://app.bucket.co/features/huddles)
✔ Generated vue types in gen/flags.d.ts.
```

> [!Note]
> By default, types will be generated in `gen/flags.d.ts`.
> The default `tsconfig.json` file `include`s this file by default, but if your `tsconfig.json` is different, make sure the file is covered in the `include` property.

### 3. Use `useFlag(<flagKey>)` to get flag value

Using the `useFlag` composable from your components lets you manage functionality in your app and track flag usage:

```vue
<script setup lang="ts">
import { useFlag, useTrack } from "@reflag/vue-sdk";

const isEnabled = useFlag("huddle"); // boolean indicating if the flag is enabled
const track = useTrack("huddle"); // track usage of the feature
</script>

<template>
  <button v-if="isEnabled" @click="track()">Start huddle!</button>
</template>
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

```vue
<ReflagProvider
  :publishable-key="publishableKey"
  :user="{ id: 'user_123', name: 'John Doe', email: 'john@acme.com' }"
  :company="{ id: 'company_123', name: 'Acme, Inc' }"
  :other-context="{ completedSteps: [1, 4, 7] }"
>
  <!-- your app -->
</ReflagProvider>
```

To retrieve flags along with their targeting information, use `useFlag(flagKey: FlagKey)` composable (described in a section below).

Note that calling `useFlag()` automatically generates a `check` event.

## Migrating from Bucket SDK

If you're migrating from the legacy Bucket SDK to Reflag SDK, here are the key changes you need to make:

### Provider changes

- **`BucketProvider`** → **`ReflagProvider`**
- **`BucketClient`** → **`ReflagClient`**

### Composable changes

- **`useFeature()`** → **`useFlag()`**
- **`useTrack()`** → **`useTrackCustom()`** for custom events (not flag keys)
- **`useTrack()`** now requires a flag key
- **`useSendFeedback()`** now requires a flag key
- **`useRequestFeedback()`** now requires a flag key

**Important**: The new `useFlag()` composable returns the flag value directly (boolean or object), not an object with methods. The methods that were previously returned by `useFeature()` are now available as separate composables:

- **`useFeature().isEnabled`** → **`useFlag()`** (returns boolean for "toggle" flags)
- **`useFeature().config`** → **`useFlag()`** (returns object for "multi-variate" flags)
- **`useFeature().track`** → **`useTrack()`** (separate composable)
- **`useFeature().requestFeedback`** → **`useRequestFeedback()`** (separate composable)
- **`useFeature().isLoading`** → **`useIsLoading()`** (separate composable)

### Configuration changes

- **`fallbackFeatures`** → **`fallbackFlags`**

  ```vue
  <!-- Old (Bucket SDK) -->
  <BucketProvider
    :fallback-features="['feature1', 'feature2']"
    <!-- or with configuration -->
    :fallback-features="{
      'feature1': true,
      'feature2': { key: 'variant-a', payload: { limit: 100 } }
    }"
  >

  <!-- New (Reflag SDK) -->
  <ReflagProvider
    :fallback-flags="['flag1', 'flag2']"
    <!-- or with configuration -->
    :fallback-flags="{
      'flag1': true,
      'flag2': { key: 'variant-a', payload: { limit: 100 } }
    }"
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

### Event changes

- **`featuresUpdated`** → **`flagsUpdated`**
- **`enabledCheck`** → **`check`** (use the unified `check` event instead)
- **`configCheck`** → **`check`** (use the unified `check` event instead)

### Example migration

```vue
<!-- Old (Bucket SDK) -->
<script setup>
import { BucketProvider, useFeature } from "@bucket/vue-sdk";

const { isEnabled, config, track } = useFeature("my-feature");
</script>

<template>
  <BucketProvider
    :publishable-key="publishableKey"
    :fallback-features="['my-feature']"
  >
    <button v-if="isEnabled" @click="track">Use Feature</button>
  </BucketProvider>
</template>

<!-- New (Reflag SDK) -->
<script setup>
import {
  ReflagProvider,
  useFlag,
  useTrack,
  useRequestFeedback,
} from "@reflag/vue-sdk";

const isEnabled = useFlag("my-flag");
const track = useTrack("my-flag");
const requestFeedback = useRequestFeedback("my-flag");
</script>

<template>
  <ReflagProvider
    :publishable-key="publishableKey"
    :fallback-flags="['my-flag']"
  >
    <div v-if="isEnabled">
      <button @click="track()">Use Flag</button>
      <button
        @click="
          requestFeedback({
            title: 'How do you like this feature?',
          })
        "
      >
        Give Feedback
      </button>
    </div>
  </ReflagProvider>
</template>
```

### Type definitions

Update your type definitions:

```typescript
// Old (Bucket SDK)
declare module "@bucket/vue-sdk" {
  interface Features {
    "my-feature": boolean;
  }
}

// New (Reflag SDK)
declare module "@reflag/vue-sdk" {
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
- `enableTracking`: Set to `false` to stop sending tracking events and user/company updates to Reflag. Useful when you're impersonating a user (defaults to `true`),
- `apiBaseUrl`: Optional base URL for the Reflag API. Use this to override the default API endpoint,
- `appBaseUrl`: Optional base URL for the Reflag application. Use this to override the default app URL,
- `sseBaseUrl`: Optional base URL for Server-Sent Events. Use this to override the default SSE endpoint,
- `debug`: Set to `true` to enable debug logging to the console,
- `toolbar`: Optional [configuration](https://docs.bucket.co/supported-languages/browser-sdk/globals#toolbaroptions) for the Reflag toolbar,
- `feedback`: Optional configuration for feedback collection

### Loading states

ReflagProvider lets you define a template to be shown while ReflagProvider is initializing:

```vue
<template>
  <ReflagProvider
    :publishable-key="publishableKey"
    :user="user"
    :company="{ id: 'acme_inc', plan: 'pro' }"
  >
    <template #loading>Loading...</template>
    <StartHuddleButton />
  </ReflagProvider>
</template>
```

If you want more control over loading screens, `useIsLoading()` returns a `Ref<boolean>` which you can use to customize the loading experience.

## Composables

### `useFlag()`

Returns the value of a given flag for the current context. The composable provides type-safe access to flag values and their configurations.
Returns `undefined` if the client is not ready yet.

For "toggle" flags, `useFlag()` returns `true`/`false`. For multi-variate flags, it returns an object of type `{ key: string, payload: TypeOfPayload }`.

Example:

```vue
<script setup lang="ts">
import {
  useFlag,
  isLoading,
  useTrack,
  useRequestFeedback,
} from "@reflag/vue-sdk";

const isLoading = useIsLoading();
const { payload } = useFlag("huddle"); // the value of the flag
const track = useTrack("huddle");
const requestFeedback = useRequestFeedback("huddle");
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-if="!isEnabled">Feature not available</div>
  <div v-else>
    <button @click="track()">Start huddle!</button>
    <button
      @click="
        (e) =>
          requestFeedback({
            title: payload?.question ?? 'How do you like the Huddles feature?',
            position: {
              type: 'POPOVER',
              anchor: e.currentTarget as HTMLElement,
            },
          })
      "
    >
      Give feedback!
    </button>
  </div>
</template>
```

### `useIsLoading()`

Returns a `Ref<boolean>` to indicate if Reflag has finished loading.

```vue
<script setup lang="ts">
import { useIsLoading } from "@reflag/vue-sdk";

const isLoading = useIsLoading();
</script>

<template>
  <div v-if="isLoading">Loading flags...</div>
</template>
```

### `useTrack()`

`useTrack()` lets you send flag track events to Reflag. Use this whenever a user _uses_ a feature guarded by a flag:

```vue
<script setup lang="ts">
import { useTrack } from "@reflag/vue-sdk";

const track = useTrack("huddle");
</script>

<template>
  <div>
    <button @click="track({ huddleType: 'voice' })">Start voice huddle!</button>
  </div>
</template>
```

### `useTrackCustom()`

`useTrackCustom()` lets you send custom events to Reflag. Use this whenever a user _uses_ a feature guarded by a flag:

```vue
<script setup lang="ts">
import { useTrackCustom } from "@reflag/vue-sdk";

const track = useTrackCustom("Huddle Started");
</script>

<template>
  <div>
    <button @click="track({ huddleType: 'voice' })">Start voice huddle!</button>
  </div>
</template>
```

### `useRequestFeedback()`

Returns a function that lets you open up a dialog to ask for feedback on a specific flag. This is useful for collecting
targeted feedback about specific features guarded by flags.

See [Automated Feedback Surveys](https://docs.bucket.co/product-handbook/live-satisfaction) for how to do this automatically, without code.
The example below shows how to use `position` to ensure the popover appears next to the "Give feedback!" button:

```vue
<script setup lang="ts">
import { useRequestFeedback } from "@reflag/vue-sdk";

const requestFeedback = useRequestFeedback("huddle-flag");
</script>

<template>
  <button
    @click="
      (e) =>
        requestFeedback({
          title: 'How satisfied are you with file uploads?',
          position: {
            type: 'POPOVER',
            anchor: e.currentTarget as HTMLElement,
          },
          // Optional custom styling
          style: {
            theme: 'light',
            primaryColor: '#007AFF',
          },
        })
    "
  >
    Give feedback!
  </button>
</template>
```

See the [Feedback Documentation](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/FEEDBACK.md#manual-feedback-collection)
for more information on `requestFeedback` options.

### `useSendFeedback()`

Returns a function that lets you send feedback to Reflag. This is useful if you've manually collected feedback through your own UI and want to send it to Reflag.

```vue
<script setup lang="ts">
import { useSendFeedback } from "@reflag/vue-sdk";

const sendFeedback = useSendFeedback("flag-key");

const handleSubmit = async (data: FormData) => {
  await sendFeedback({
    score: parseInt(data.get("score") as string),
    comment: data.get("comment") as string,
  });
};
</script>

<template>
  <form @submit="handleSubmit">
    <!-- form content -->
  </form>
</template>
```

### `useUpdateUser()`, `useUpdateCompany()` and `useUpdateOtherContext()`

These composables return functions that let you update the attributes for the currently set user, company, or other context. Updates to user/company
are stored remotely and affect flag targeting, while "other" context updates only affect the current session.

```vue
<script setup lang="ts">
import {
  useUpdateUser,
  useUpdateCompany,
  useUpdateOtherContext,
} from "@reflag/vue-sdk";

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
</script>

<template>
  <div>
    <button @click="handleUserUpdate">Update User</button>
    <button @click="handleCompanyUpdate">Update Company</button>
    <button @click="handleContextUpdate">Update Context</button>
  </div>
</template>
```

Note: To change the `user.id` or `company.id`, you need to update the props passed to `ReflagProvider` instead of using these composables.

### `useClient()`

Returns the `ReflagClient` used by the `ReflagProvider`. The client offers more functionality that
is not directly accessible through the other composables.

```vue
<script setup>
import { useClient } from "@reflag/vue-sdk";
import { onMounted } from "vue";

const client = useClient();

onMounted(() => {
  client.value.on("check", (evt) => {
    console.log(`The flag ${evt.flagKey} is ${evt.value} for user.`);
  });
});
</script>

<template>
  <!-- your component content -->
</template>
```

## Content Security Policy (CSP)

See [CSP](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/README.md#content-security-policy-csp) for info on using Reflag Vue SDK with CSP

## License

MIT License

Copyright (c) 2025 Bucket ApS
