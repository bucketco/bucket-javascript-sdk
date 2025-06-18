<template>
  <div v-if="!publishableKey">
    <MissingKeyMessage />
  </div>
  <BucketProvider v-else :publishableKey="publishableKey" :user="user">
    <template #loading>Loadinaaaaaaaaaaaaag....</template>
    <StartHuddleButton />
  </BucketProvider>
</template>

<script setup lang="ts">
import { h } from "vue";
import { BucketProvider } from "../../src";
import MissingKeyMessage from "./components/MissingKeyMessage.vue";
import StartHuddleButton from "./components/StartHuddleButton.vue";

const publishableKey = import.meta.env.VITE_PUBLISHABLE_KEY || "";

const user = { id: "123", name: "John Doe" };
</script>
