<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ value: number; max: number; size?: number }>(), { size: 72 })
const RADIUS = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const offset = computed(() => CIRCUMFERENCE * (1 - (props.max ? props.value / props.max : 0)))
</script>

<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" :r="RADIUS" class="track" />
      <circle
        cx="36"
        cy="36"
        :r="RADIUS"
        class="bar"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="offset"
      />
    </svg>
    <span class="label"
      ><slot>{{ value }}/{{ max }}</slot></span
    >
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  flex: none;
}
svg {
  transform: rotate(-90deg);
}
circle {
  fill: none;
  stroke-width: 7;
}
.track {
  stroke: var(--surface-2);
}
.bar {
  stroke: var(--accent);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.8s var(--ease);
}
.label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--text-sm);
}
</style>
