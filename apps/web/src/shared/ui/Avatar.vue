<script setup lang="ts">
import { computed } from 'vue'

/** Initials in a coloured circle; the colour follows the name, so a person keeps theirs everywhere. */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 40 })
const TONES = ['lime', 'peach', 'sky', 'accent'] as const

const initials = computed(() =>
  props.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join(''),
)
const tone = computed(
  () => TONES[[...props.name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % TONES.length],
)
</script>

<template>
  <span class="avatar" :class="tone" :style="{ '--size': `${size}px` }" aria-hidden="true">{{
    initials
  }}</span>
</template>

<style scoped>
.avatar {
  display: inline-grid;
  flex: none;
  place-items: center;
  inline-size: var(--size);
  block-size: var(--size);
  border-radius: 50%;
  font-weight: 700;
  font-size: calc(var(--size) * 0.38);
}
.lime {
  background: var(--lime);
  color: var(--on-lime);
}
.peach {
  background: var(--peach);
  color: var(--on-peach);
}
.sky {
  background: var(--sky);
  color: var(--on-sky);
}
.accent {
  background: var(--accent-tint);
  color: var(--accent-ink);
}
</style>
