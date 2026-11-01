<script setup lang="ts">
import CountUp from './CountUp.vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    note?: string
    tone?: 'surface' | 'lime' | 'peach' | 'sky' | 'ink'
  }>(),
  {
    tone: 'surface',
  },
)
</script>

<template>
  <div class="tile" :class="tone">
    <p class="label">{{ label }}</p>
    <p class="value">
      <CountUp v-if="typeof value === 'number'" :value="value" /><template v-else>{{ value }}</template>
    </p>
    <p v-if="note" class="note">{{ note }}</p>
  </div>
</template>

<style scoped>
.tile {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.label {
  font-size: var(--text-sm);
  font-weight: 600;
}
.value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1.1;
}
.note {
  font-size: var(--text-xs);
  opacity: 0.75;
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
.ink {
  background: var(--ink);
  color: var(--on-ink);
}
@media (width < 600px) {
  .tile {
    padding: var(--space-4);
  }
}
</style>
