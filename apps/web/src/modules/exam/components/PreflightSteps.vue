<script setup lang="ts">
import { Check } from 'lucide-vue-next'

/** Where the student is on the way in: check the device, agree, start. `current` is 0-based. */
defineProps<{ current: number }>()
const STEPS = ['check', 'consent', 'start'] as const
</script>

<template>
  <ol class="steps" :aria-label="$t('exam.preflight.steps.label')">
    <li
      v-for="(step, i) in STEPS"
      :key="step"
      :class="{ done: i < current, now: i === current }"
      :aria-current="i === current ? 'step' : undefined"
    >
      <span class="dot" aria-hidden="true">
        <Check v-if="i < current" :size="12" />
        <template v-else>{{ i + 1 }}</template>
      </span>
      {{ $t(`exam.preflight.steps.${step}`) }}
    </li>
  </ol>
</template>

<style scoped>
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
li {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px var(--space-3) 6px 6px;
  border-radius: var(--radius-pill);
  color: var(--text-2);
  font-size: var(--text-sm);
  font-weight: 600;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
  &.now {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-1);
  }
  &.done {
    background: var(--ok-tint);
    color: var(--ok);
  }
}
.dot {
  display: inline-grid;
  place-items: center;
  inline-size: 22px;
  block-size: 22px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: var(--text-xs);
  .now & {
    background: var(--accent);
    color: var(--on-accent);
  }
  .done & {
    background: var(--ok);
    color: var(--on-ok);
  }
}
</style>
