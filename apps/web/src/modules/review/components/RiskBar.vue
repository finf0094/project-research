<script setup lang="ts">
import { computed } from 'vue'
import { riskLevel } from '../labels'

/**
 * An attempt's risk score as a short bar and its number. Neutral on purpose: the score orders the list,
 * it accuses no one; only a high score is drawn stronger.
 */
const props = defineProps<{ risk: number | null }>()
const level = computed(() => riskLevel(props.risk))
</script>

<template>
  <span v-if="risk === null" class="muted">—</span>
  <span v-else class="risk" :class="level">
    <span class="bar" aria-hidden="true"><span :style="{ inlineSize: `${Math.min(100, risk)}%` }" /></span>
    <b>{{ risk }}</b>
  </span>
</template>

<style scoped>
.risk {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
.bar {
  display: inline-block;
  inline-size: 72px;
  block-size: 6px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: var(--off);
    transition:
      inline-size var(--dur-slow) var(--ease),
      background-color var(--dur) var(--ease);
  }
}
.high .bar span {
  background: var(--text);
}
</style>
