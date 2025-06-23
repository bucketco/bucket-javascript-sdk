# Bucket Vue SDK (beta)

Vue client side library for [Bucket.co](https://bucket.co)

Bucket supports feature toggling, tracking feature usage, requesting feedback on features and remotely configuring features.

The Bucket Vue SDK comes with the same built-in toolbar as the browser SDK which appears on `localhost` by default.

## Install

Install via npm:

```shell
npm i @bucketco/vue-sdk
```

## Get started

### 1. Wrap your application with the `BucketProvider`

```vue
<script setup lang="ts">
import { BucketProvider } from "@bucketco/vue-sdk";
</script>

<BucketProvider
  :publishable-key="publishableKey"
  :user="{ id: 'user_123', name: 'John Doe', email: 'john@acme.com' }"
  :company="{ id: 'acme_inc', plan: 'pro' }"
>
  <!-- your app -->
</BucketProvider>
```

If using Nuxt, wrap `<BucketProvider>` in `<ClientOnly>`. `<BucketProvider>` only renders client-side currently.

### 2. Use `useFeature(key)` to get feature status

```vue
<script setup lang="ts">
import { useFeature } from "@bucketco/vue-sdk";

const huddle = useFeature("huddle");
</script>

<template>
  <div v-if="huddle.isEnabled">
    <button @click="huddle.track()">Start huddle!</button>
</template>
```

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

```vue
<BucketProvider
  :publishable-key="publishableKey"
  :user="{ id: 'user_123', name: 'John Doe', email: 'john@acme.com' }"
  :company="{ id: 'acme_inc', plan: 'pro' }"
></BucketProvider>
```

To retrieve features along with their targeting information, use `useFeature(key: string)` hook (described in a section below).

Note that accessing `isEnabled` on the object returned by `useFeature()` automatically
generates a `check` event.

## Remote config

Remote config is a dynamic and flexible approach to configuring feature behavior outside of your app – without needing to re-deploy it.

Similar to `isEnabled`, each feature accessed using the `useFeature()` hook, has a `config` property. This configuration is managed from within Bucket. It is managed similar to the way access to features is managed, but instead of the
binary `isEnabled` you can have multiple configuration values which are given to different user/companies.

### Get started with Remote config

```ts
const {
  isEnabled,
  config: { key, payload },
} = useFeature("huddles");

// isEnabled: true,
// key: "gpt-3.5",
// payload: { maxTokens: 10000, model: "gpt-3.5-beta1" }
```

`key` is mandatory for a config, but if a feature has no config or no config value was matched against the context, the `key` will be `undefined`. Make sure to check against this case when trying to use the configuration in your application. `payload` is an optional JSON value for arbitrary configuration needs.

Note that, similar to `isEnabled`, accessing `config` on the object returned by `useFeature()` automatically
generates a `check` event.

## `<BucketProvider>` component

The `<BucketProvider>` initializes the Bucket SDK, fetches features and starts listening for automated feedback survey events. The component can be configured using a number of props:

- `publishableKey` is used to connect the provider to an _environment_ on Bucket. Find your `publishableKey` under [environment settings](https://app.bucket.co/envs/current/settings/app-environments) in Bucket,
- `company`, `user` and `otherContext` make up the _context_ that is used to determine if a feature is enabled or not. `company` and `user` contexts are automatically transmitted to Bucket servers so the Bucket app can show you which companies have access to which features etc.

  > [!Note]
  > If you specify `company` and/or `user` they must have at least the `id` property, otherwise they will be ignored in their entirety. You should also supply anything additional you want to be able to evaluate feature targeting against,

- `timeoutMs`: Timeout in milliseconds when fetching features from the server,
- `staleWhileRevalidate`: If set to `true`, stale features will be returned while refetching features in the background,
- `expireTimeMs`: If set, features will be cached between page loads for this duration (in milliseconds),
- `staleTimeMs`: Maximum time (in milliseconds) that stale features will be returned if `staleWhileRevalidate` is true and new features cannot be fetched.

- `enableTracking`: Set to `false` to stop sending tracking events and user/company updates to Bucket. Useful when you're impersonating a user (defaults to `true`),
- `apiBaseUrl`: Optional base URL for the Bucket API. Use this to override the default API endpoint,
- `appBaseUrl`: Optional base URL for the Bucket application. Use this to override the default app URL,
- `sseBaseUrl`: Optional base URL for Server-Sent Events. Use this to override the default SSE endpoint,
- `debug`: Set to `true` to enable debug logging to the console,
- `toolbar`: Optional [configuration](https://docs.bucket.co/supported-languages/browser-sdk/globals#toolbaroptions) for the Bucket toolbar,
- `feedback`: Optional configuration for feedback collection

### Loading states

BucketProvider lets you define a template to be shown while BucketProvider is inititalizing:

```vue
<template>
  <BucketProvider
    :publishable-key="publishableKey"
    :user="user"
    :company="{ id: 'acme_inc', plan: 'pro' }"
  >
    <template #loading>Loading...</template>
    <StartHuddleButton />
  </BucketProvider>
</template>
```

If you want more control over loading screens, `useIsLoading()` returns a Ref<boolean> which you can use to customize the loading experience.

## Hooks

### `useFeature()`

Returns the state of a given feature for the current context. The composable provides type-safe access to feature flags and their configurations.

```vue
<script setup lang="ts">
import { useFeature } from "@bucketco/vue-sdk";

const huddle = useFeature("huddle");
</script>

<template>
  <div v-if="huddle.isLoading">Loading...</div>
  <div v-else-if="!huddle.isEnabled">Feature not available</div>
  <div v-else>
    <button @click="huddle.track()">Start huddle!</button>
    <button
      @click="
        (e) =>
          huddle.requestFeedback({
            title:
              huddle.config.payload?.question ??
              'How do you like the Huddles feature?',
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

See the reference docs for details.

### `useTrack()`

`useTrack()` lets you send custom events to Bucket. Use this whenever a user _uses_ a feature.

```vue
<script setup lang="ts">
import { useTrack } from "@bucketco/vue-sdk";

const track = useTrack();
</script>

<template>
  <div>
    <button @click="track('Huddle Started', { huddleType: 'voice' })">
      Start voice huddle!
    </button>
  </div>
</template>
```

### `useRequestFeedback()`

Returns a function that lets you open up a dialog to ask for feedback on a specific feature. This is useful for collecting targeted feedback about specific features.

See [Automated Feedback Surveys](https://docs.bucket.co/product-handbook/live-satisfaction) for how to do this automatically, without code.

When using the `useRequestFeedback` you must pass the feature key to `requestFeedback`.
The example below shows how to use `position` to ensure the popover appears next to the "Give feedback!" button.

```vue
<script setup lang="ts">
import { useRequestFeedback } from "@bucketco/vue-sdk";

const requestFeedback = useRequestFeedback();
</script>

<template>
  <button
    @click="
      (e) =>
        requestFeedback({
          featureKey: 'huddle-feature',
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

See the [Feedback Documentation](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/FEEDBACK.md#manual-feedback-collection) for more information on `requestFeedback` options.

### `useSendFeedback()`

Returns a function that lets you send feedback to Bucket. This is useful if you've manually collected feedback through your own UI and want to send it to Bucket.

```vue
<script setup lang="ts">
import { useSendFeedback } from "@bucketco/vue-sdk";

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
</script>

<template>
  <form @submit="handleSubmit">
    <!-- form content -->
  </form>
</template>
```

### `useUpdateUser()`, `useUpdateCompany()` and `useUpdateOtherContext()`

These composables return functions that let you update the attributes for the currently set user, company, or other context. Updates to user/company are stored remotely and affect feature targeting, while "other" context updates only affect the current session.

```vue
<script setup lang="ts">
import {
  useUpdateUser,
  useUpdateCompany,
  useUpdateOtherContext,
} from "@bucketco/vue-sdk";

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

Note: To change the `user.id` or `company.id`, you need to update the props passed to `BucketProvider` instead of using these composables.

### `useClient()`

Returns the `BucketClient` used by the `BucketProvider`. The client offers more functionality that
is not directly accessible through the other composables.

```vue
<script setup>
import { useClient } from "@bucketco/vue-sdk";
import { onMounted } from "vue";

const client = useClient();

onMounted(() => {
  client.value.on("check", (evt) => {
    console.log(`The feature ${evt.key} is ${evt.value} for user.`);
  });
});
</script>

<template>
  <!-- your component content -->
</template>
```

### `useIsLoading()`

Returns a `Ref<boolean>` to indicate if Bucket has finished loading.

## Content Security Policy (CSP)

See [CSP](https://github.com/bucketco/bucket-javascript-sdk/blob/main/packages/browser-sdk/README.md#content-security-policy-csp) for info on using Bucket React SDK with CSP

## License

MIT License

Copyright (c) 2025 Bucket ApS
