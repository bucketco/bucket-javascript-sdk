<script setup lang="ts">
import canonicalJson from "canonical-json";
import { provide, ref, shallowRef, watch } from "vue";

import { BucketClient } from "@bucketco/browser-sdk";

import { ProviderSymbol } from "./hooks";
import { BucketProps, ProviderContextType } from "./types";
import { SDK_VERSION } from "./version";

const featuresLoading = ref(true);
const updatedCount = ref<number>(0);

// any optional prop which has boolean as part of the type, will default to false
// instead of `undefined`, so we use `withDefaults` here to pass the undefined
// down into the client.
const props = withDefaults(defineProps<BucketProps>(), {
  enableTracking: undefined,
  toolbar: undefined,
});

function updateClient() {
  const cnext = (
    props.newBucketClient ?? ((...args) => new BucketClient(...args))
  )({
    ...props,
    logger: props.debug ? console : undefined,
    sdkVersion: SDK_VERSION,
  });
  featuresLoading.value = true;
  cnext
    .initialize()
    .catch((e) => cnext.logger.error("failed to initialize client", e))
    .finally(() => {
      featuresLoading.value = false;
    });

  return cnext;
}

watch(
  () =>
    canonicalJson(
      // canonicalJson doesn't handle `undefined` values, so we stringify/parse to remove them
      JSON.parse(
        JSON.stringify({
          user: props.user,
          company: props.company,
          otherContext: props.otherContext,
        }),
      ),
    ),
  () => {
    clientRef.value = updateClient();
  },
);

const clientRef = shallowRef<BucketClient>(updateClient());

const context = {
  isLoading: featuresLoading,
  updatedCount: updatedCount,
  client: clientRef,
  provider: true,
} satisfies ProviderContextType;

provide(ProviderSymbol, context);
</script>

<template>
  <slot v-if="featuresLoading && $slots.loading" name="loading" />
  <slot v-else />
</template>
