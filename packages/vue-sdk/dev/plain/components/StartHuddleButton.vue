<script setup lang="ts">
import { useFeature } from "../../../src";

const huddle = useFeature("huddle");
</script>
<template>
  <div>
    Huddle: {{ huddle.isEnabled }}
    <span v-if="huddle.isLoading">Loading...</span>
    <span v-else-if="!huddle.isEnabled">Not enabled</span>
    <span v-else>
      <button @click="huddle.track()">
        {{ huddle.config.value?.payload?.buttonTitle ?? "Start Huddle" }}
      </button>
      <button
        @click="huddle.requestFeedback({ title: 'Do you like huddles?' })"
      >
        Request Feedback
      </button>
    </span>
  </div>
</template>
