<!-- App.vue -->
<template>
  <BucketProvider :loading-component="LoadingSpinner">
    <div id="slick-app">
      <header>
        <h1>Welcome to Slick</h1>
        <p>The next-gen team communication platform</p>
      </header>
      <main v-if="huddles">
        <p>Welcome to the beta program!</p>
      </main>
    </div>
  </BucketProvider>
</template>

<script lang="ts">
import { defineComponent, onMounted } from "vue";
import { BucketProvider, useFeature } from "@bucketco/vue-sdk";

export default defineComponent({
  name: "App",
  components: {
    BucketProvider,
  },
  setup() {
    const { isEnabled } = useFeature("huddles");

    return {
      huddles: isEnabled,
      LoadingSpinner: () => import("./LoadingSpinner.vue"),
    };
  },
});
</script>
