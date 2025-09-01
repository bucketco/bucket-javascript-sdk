<script setup lang="ts">
import {
  useFlag,
  useIsLoading,
  useRequestFeedback,
  useTrackCustom,
} from "../../../src";

import Section from "./Section.vue";

const flag = useFlag("huddles");
const track = useTrackCustom("Huddle Started");
const isLoading = useIsLoading();
const payload =
  flag && typeof flag === "object" && "payload" in flag ? flag.payload : {};
const requestFeedback = useRequestFeedback("huddles");
</script>
<template>
  <Section title="Huddle">
    <div style="display: flex; gap: 10px; flex-wrap: wrap">
      <div>Huddle enabled: {{ flag }}</div>
      <div v-if="isLoading">Loading...</div>
      <div v-else style="display: flex; gap: 10px; flex-wrap: wrap">
        <div>
          <button @click="track()">
            {{ payload.buttonTitle ?? "Start Huddle (track event)" }}
          </button>
        </div>
        <div>
          <button
            @click="
              (e) =>
                requestFeedback({
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
