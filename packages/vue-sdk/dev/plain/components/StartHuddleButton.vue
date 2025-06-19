<script setup lang="ts">
import { useFeature } from "../../../src";

import Section from "./Section.vue";

const huddle = useFeature("huddle");
</script>
<template>
  <Section title="Huddle">
    <div style="display: flex; gap: 10px; flex-wrap: wrap">
      <div>Huddle enabled: {{ huddle.isEnabled }}</div>
      <div v-if="huddle.isLoading">Loading...</div>
      <div v-else style="display: flex; gap: 10px; flex-wrap: wrap">
        <div>
          <button @click="huddle.track()">
            {{
              huddle.config.payload?.buttonTitle ?? "Start Huddle (track event)"
            }}
          </button>
        </div>
        <div>
          <button
            @click="
              (e) =>
                huddle.requestFeedback({
                  title: 'Do you like huddles?',
                })
            "
          >
            Trigger survey
          </button>
        </div>
      </div>
    </div>
  </Section>
</template>
