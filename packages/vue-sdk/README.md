# Bucket Vue SDK

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
import { BucketProvider } from '@bucketco/vue-sdk'
</script>

<BucketProvider
  publishableKey="{YOUR_PUBLISHABLE_KEY}"
  :company="{ id: 'acme_inc', plan: 'pro' }"
  :user="{ id: 'john doe' }"
>
  <!-- your app -->
</BucketProvider>
```

### 2. Create a new feature and set up type safety

Install the Bucket CLI:

```shell
npm i --save-dev @bucketco/cli
```

Run `npx bucket new` to create your first feature!
On the first run, it will sign into Bucket and set up type generation for your project:

```shell
❯ npx bucket new
Opened web browser to facilitate login: https://app.bucket.co/api/oauth/cli/authorize

Welcome to Bucket!

? Where should we generate the types? gen/features.d.ts
? What is the output format? vue
✔ Configuration created at bucket.config.json.

Creating feature for app Slick app.
? New feature name: Huddle
? New feature key: huddle
✔ Created feature Huddle with key huddle (https://app.bucket.co/features/huddles)
✔ Generated vue types in gen/features.d.ts.
```

> [!Note]
> By default, types will be generated in `gen/features.d.ts`.
> The default `tsconfig.json` file `include`s this file by default, but if your `tsconfig.json` is different, make sure the file is covered in the `include` property.

### 3. Use `useFeature(key)` to get feature status

```vue
<script setup lang="ts">
import { useFeature } from '@bucketco/vue-sdk'

const huddle = useFeature('huddle')
</script>

<template>
  <button v-if="huddle.isEnabled" @click="huddle.track()">
    {{ huddle.config?.payload?.buttonTitle ?? 'Start Huddle' }}
  </button>
</template>
```

See the [browser SDK documentation](../browser-sdk/README.md) for all available methods.
