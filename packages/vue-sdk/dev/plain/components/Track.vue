<script setup lang="ts">
import { useTrackCustom } from "../../../src";

import Section from "./Section.vue";

const track = useTrackCustom("Huddle Started");
</script>

<template>
  <Section title="Custom track event">
    <button @click="track({ huddleType: 'voice' })">
      Send custom track event
    </button>
  </Section>
</template>
