<script setup lang="ts">
import { ref } from "vue";

import { BucketProvider } from "../../src";

import MissingKeyMessage from "./components/MissingKeyMessage.vue";
import StartHuddleButton from "./components/StartHuddleButton.vue";

const publishableKey = import.meta.env.VITE_PUBLISHABLE_KEY || "";

const user = ref({ id: "123", name: "John Doe" });
</script>

<template>
  <div v-if="!publishableKey">
    <MissingKeyMessage />
  </div>
  <BucketProvider
    v-else
    :publishableKey="publishableKey"
    :user="user"
    :company="{ id: 'acme_inc', plan: 'pro' }"
  >
    <template #loading>......loading......</template>
    <StartHuddleButton />
  </BucketProvider>
  <input v-model="user.id" />
  <span>{{ user.id }}</span>
</template>
