<script setup lang="ts">
import type { StudentResult } from '@exam/contracts'
import { computed } from 'vue'
import { formatDay } from '@/shared/lib/format'
import { CountUp } from '@/shared/ui'

/** The score as a ring that fills up, with a one-line verdict and the facts of the review. */
const props = defineProps<{ result: StudentResult }>()
const R = 54
const LENGTH = 2 * Math.PI * R
const title = computed(() => {
  const { score, passed } = props.result
  if (score === null) return 'none'
  if (!passed) return 'fail'
  return score >= 85 ? 'high' : score >= 70 ? 'good' : 'pass'
})
</script>

<template>
  <section class="card">
    <div class="ring">
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" :r="R" class="track" />
        <circle
          cx="64"
          cy="64"
          :r="R"
          class="bar"
          :class="{ fail: result.passed === false }"
          :stroke-dasharray="LENGTH"
          :style="{ '--to': LENGTH * (1 - (result.score ?? 0) / 100), '--from': LENGTH }"
        />
      </svg>
      <p class="score">
        <template v-if="result.score !== null"><CountUp :value="result.score" :duration="900" /></template>
        <template v-else>—</template>
        <span class="out">{{ $t('student.result.outOf') }}</span>
      </p>
    </div>
    <span class="orb" aria-hidden="true" />
    <h1>{{ $t(`student.result.title.${title}`) }}</h1>
    <dl class="facts">
      <div>
        <dt>{{ $t('student.result.date') }}</dt>
        <dd>{{ formatDay(result.decidedAt) }}</dd>
      </div>
      <div>
        <dt>{{ $t('student.result.questions') }}</dt>
        <dd>{{ result.questions.length }}</dd>
      </div>
      <div>
        <dt>{{ $t('student.result.reviewer') }}</dt>
        <dd>{{ result.reviewer }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: var(--space-5);
  overflow: hidden;
  padding: var(--space-8) var(--space-6) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
  &::after {
    content: '';
    position: absolute;
    inset-block-start: -30%;
    inset-inline-end: -25%;
    inline-size: 280px;
    aspect-ratio: 1;
    border: 1px dashed var(--on-ink-line);
    border-radius: 50%;
  }
}
.orb {
  position: absolute;
  inset-block-start: 84px;
  inset-inline-end: 64px;
  inline-size: 14px;
  block-size: 14px;
  border-radius: 50%;
  background: var(--lime);
  animation: float 4s ease-in-out infinite alternate;
}
@keyframes float {
  to {
    translate: 0 -12px;
  }
}
.ring {
  position: relative;
  inline-size: 160px;
  aspect-ratio: 1;
  svg {
    inline-size: 100%;
    rotate: -90deg;
  }
}
circle {
  fill: none;
  stroke-width: 10;
  stroke-linecap: round;
}
.track {
  stroke: var(--on-ink-tint);
}
.bar {
  stroke: var(--lime);
  stroke-dashoffset: var(--to);
  animation: fill 1.1s var(--ease) both;
  &.fail {
    stroke: #f2a46b;
  }
}
@keyframes fill {
  from {
    stroke-dashoffset: var(--from);
  }
}
.score {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  font-family: var(--font-display);
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1;
  .out {
    margin-top: var(--space-1);
    color: var(--on-ink-2);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 400;
  }
}
h1 {
  font-size: var(--text-2xl);
}
.facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: 0;
  div {
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--on-ink-tint);
  }
  dt {
    color: var(--on-ink-2);
    font-size: var(--text-xs);
  }
  dd {
    margin: 0;
    font-weight: 700;
    font-size: var(--text-sm);
  }
}
</style>
