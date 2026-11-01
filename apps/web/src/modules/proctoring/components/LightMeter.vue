<script setup lang="ts">
import { Sun } from 'lucide-vue-next'
import { computed } from 'vue'
import { DARK_BRIGHTNESS } from '../signals'

/** How lit the face is, as six segments and a word: dark, fine or good. `brightness`: 0..255, or unknown. */
const props = defineProps<{ brightness: number | null }>()
const SEGMENTS = 6
/** Lit segments: the dark threshold lights two of them, a well-lit room all six. */
const lit = computed(() =>
  props.brightness === null
    ? 0
    : Math.min(SEGMENTS, Math.round((props.brightness / (DARK_BRIGHTNESS * 3)) * SEGMENTS)),
)
const level = computed(() =>
  (props.brightness ?? 0) < DARK_BRIGHTNESS ? 'dark' : lit.value < SEGMENTS ? 'ok' : 'good',
)
</script>

<template>
  <div class="meter" :class="level">
    <Sun :size="16" aria-hidden="true" />
    <span aria-hidden="true">{{ $t('proctoring.check.light') }}</span>
    <span
      class="segments"
      role="meter"
      :aria-valuenow="lit"
      aria-valuemin="0"
      :aria-valuemax="SEGMENTS"
      :aria-valuetext="$t(`proctoring.stage.light.${level}`)"
      :aria-label="$t('proctoring.check.light')"
    >
      <span v-for="i in SEGMENTS" :key="i" :class="{ on: i <= lit }" />
    </span>
    <b aria-hidden="true">{{ $t(`proctoring.stage.light.${level}`) }}</b>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius);
  background: var(--scrim-strong);
  backdrop-filter: blur(8px);
  color: var(--on-ink);
  font-size: var(--text-xs);
}
.segments {
  display: flex;
  flex: 1;
  gap: 4px;
  span {
    flex: 1;
    block-size: 5px;
    border-radius: var(--radius-pill);
    background: var(--on-ink-tint-3);
    transition: background-color var(--dur) var(--ease);
  }
}
.segments .on {
  background: var(--lime);
}
.dark .segments .on {
  background: var(--peach);
}
</style>
