<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";

import { CheckEvent, TrackEvent, useClient } from "../../../src";

import Section from "./Section.vue";

const client = useClient();

const events = ref<string[]>([]);

function checkEvent(evt: CheckEvent) {
  events.value = [
    ...events.value,
    `Check event: The flag ${evt.flagKey} is ${evt.value} for user.`,
  ];
}

function flagsUpdatedEvent() {
  events.value = [...events.value, `Flags Updated!`];
}

function trackEvent(evt: TrackEvent) {
  events.value = [...events.value, `Track event: ${evt.eventName}`];
}

onMounted(() => {
  client.value.on("check", checkEvent);
  client.value.on("flagsUpdated", flagsUpdatedEvent);
  client.value.on("track", trackEvent);
});
onUnmounted(() => {
  client.value.off("check", checkEvent);
  client.value.off("flagsUpdated", flagsUpdatedEvent);
  client.value.off("track", trackEvent);
});
</script>

<template>
  <Section title="Events">
    <div
      style="display: flex; gap: 10px; flex-wrap: wrap; flex-direction: column"
    >
      <div v-for="event in events" :key="event">
        {{ event }}
      </div>
    </div>
  </Section>
</template>
