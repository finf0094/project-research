<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDuration } from '@/shared/lib/format'

const props = defineProps<{ remainingMs: number }>()
const { t } = useI18n()
const LOW_MS = 5 * 60_000
const low = computed(() => props.remainingMs <= LOW_MS)
// The visible timer is not announced every second; screen readers hear only the moment time runs low.
const announcement = computed(() => (low.value ? t('exam.timer.low') : ''))
</script>

<template>
  <span class="timer" :class="{ low }" role="timer" :aria-label="$t('exam.timer.label')">
    {{ formatDuration(remainingMs) }}
  </span>
  <span class="visually-hidden" aria-live="assertive">{{ announcement }}</span>
</template>

<style scoped>
.timer {
  display: inline-flex;
  align-items: center;
  min-height: 48px;
  padding: 0 var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  font-family: var(--font-display);
  font-size: var(--text-lg);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  transition:
    background-color 0.3s,
    color 0.3s;
}
.low {
  background: var(--warn-tint);
  color: var(--warn);
}
</style>
