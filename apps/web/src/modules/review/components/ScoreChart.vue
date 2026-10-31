<script setup lang="ts">
import { computed } from 'vue'
import { BANDS } from '../grade-sheet'
import { PASS_SCORE } from '../exam-state'

/** Scored attempts per band; bars grow in from the baseline. Below the pass mark in peach, above in accent. */
const props = defineProps<{ counts: number[]; total: number }>()
const max = computed(() => Math.max(1, ...props.counts))
</script>

<template>
  <section class="chart">
    <header>
      <h2>{{ $t('hub.results.distribution') }}</h2>
      <span class="muted note">{{ $t('hub.results.checkedCount', { n: total }) }}</span>
    </header>
    <ol class="bars">
      <li v-for="(n, i) in counts" :key="i" :class="{ fail: BANDS[i]![1] < PASS_SCORE }">
        <span class="n">{{ n }}</span>
        <span class="bar" :style="{ blockSize: `${(100 * n) / max}%`, animationDelay: `${i * 60}ms` }" />
        <span class="band">{{ BANDS[i]![0] }}–{{ BANDS[i]![1] }}</span>
      </li>
    </ol>
    <p class="legend muted">
      <span class="key fail" />{{ $t('hub.results.fail') }} <span class="key" />{{ $t('hub.results.pass') }}
    </p>
  </section>
</template>

<style scoped>
.chart {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  h2 {
    font-size: var(--text-lg);
  }
}
.note {
  font-size: var(--text-sm);
}
.bars {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-3);
  block-size: 200px;
  padding: 0;
  list-style: none;
  border-bottom: 1px solid var(--border);
}
li {
  display: grid;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  align-items: end;
  gap: var(--space-1);
}
.n {
  font-family: var(--font-display);
  font-weight: 700;
}
.bar {
  inline-size: 100%;
  min-block-size: 4px;
  border-radius: var(--radius-sm) var(--radius-sm) 4px 4px;
  background: var(--accent);
  transform-origin: bottom;
  animation: grow var(--dur-slow) var(--ease-spring) both;
}
.fail .bar {
  background: #f2a46b;
}
.band {
  translate: 0 22px;
  color: var(--text-2);
  font-size: var(--text-xs);
}
@keyframes grow {
  from {
    transform: scaleY(0);
  }
}
.legend {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  font-size: var(--text-xs);
}
.key {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 3px;
  background: var(--accent);
  &.fail {
    background: #f2a46b;
  }
}
</style>
