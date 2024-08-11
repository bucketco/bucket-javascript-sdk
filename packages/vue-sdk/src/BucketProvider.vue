<!-- BucketProvider.vue -->
<template>
  <slot v-if="!isLoading || !loadingComponent" />
  <component :is="loadingComponent" v-else />
</template>

<script lang="ts">
import { computed, defineComponent } from "vue";

import { useBucket } from "./useBucket";

export default defineComponent({
  name: "BucketProvider",
  props: {
    loadingComponent: {
      type: [Object, Function, String],
      default: null,
    },
  },
  setup() {
    const bucket = useBucket();
    const isLoading = computed(() => (bucket ? bucket?.state.isLoading : true));

    return {
      isLoading,
    };
  },
});
</script>
