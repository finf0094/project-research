<script setup lang="ts">
import { TYPE_ICON } from '../question-types'
import type { QuestionOutcome } from '@exam/contracts'
import { computed, ref } from 'vue'
import { PillTabs } from '@/shared/ui'

/** Every question with its points, the answer given and the right one; filter to the mistakes. */
const props = defineProps<{ questions: QuestionOutcome[] }>()
const filter = ref<'all' | 'mistakes'>('all')
const mistake = (q: QuestionOutcome) => q.status === 'wrong' || q.status === 'unanswered'
const shown = computed(() =>
  props.questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => filter.value === 'all' || mistake(q)),
)
const count = (status: QuestionOutcome['status']) => props.questions.filter((q) => q.status === status).length
const TONE = { correct: 'ok', wrong: 'danger', unanswered: 'warn', examiner: 'accent' } as const
</script>

<template>
  <section class="card">
    <header class="head">
      <h2>{{ $t('student.result.breakdown') }}</h2>
      <PillTabs
        v-model="filter"
        :label="$t('student.result.filter')"
        :items="[
          { value: 'all', label: $t('student.result.all'), count: questions.length },
          {
            value: 'mistakes',
            label: $t('student.result.mistakes'),
            count: questions.filter(mistake).length,
          },
        ]"
      />
    </header>
    <p class="legend">
      <span v-for="(tone, status) in TONE" :key="status" :class="tone"
        >{{ $t(`student.result.status.${status}`) }} · {{ count(status) }}</span
      >
    </p>
    <ol class="list stagger">
      <li v-for="{ q, n } in shown" :key="n" class="item">
        <span class="n">{{ String(n).padStart(2, '0') }}</span>
        <span class="icon" :class="TONE[q.status]"
          ><component :is="TYPE_ICON[q.type]" :size="16" aria-hidden="true"
        /></span>
        <div class="body">
          <p class="text">{{ q.text }}</p>
          <span class="status" :class="TONE[q.status]">{{ $t(`student.result.status.${q.status}`) }}</span>
          <p v-if="q.status !== 'correct' && (q.answer || q.correct)" class="answer">
            <span v-if="q.answer">{{ $t('student.result.yourAnswer', { answer: q.answer }) }}</span>
            <span v-if="q.correct" class="right">{{
              $t('student.result.rightAnswer', { answer: q.correct })
            }}</span>
          </p>
        </div>
        <span class="points"
          ><b>{{ q.earned ?? '—' }}</b
          >/{{ q.points }}</span
        >
      </li>
    </ol>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-4);
  align-content: start;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-xl);
  }
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  font-size: var(--text-xs);
  span::before {
    content: '';
    display: inline-block;
    inline-size: 8px;
    block-size: 8px;
    margin-inline-end: 6px;
    border-radius: 50%;
    background: currentColor;
  }
}
.list {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.item {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
}
.n {
  padding-top: 6px;
  color: var(--text-2);
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 700;
}
.icon {
  display: grid;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border-radius: var(--radius-sm);
  background: var(--surface);
}
.body {
  display: grid;
  gap: var(--space-1);
  justify-items: start;
}
.text {
  font-weight: 600;
}
.status {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 700;
}
.answer {
  display: grid;
  gap: var(--space-1);
  inline-size: 100%;
  margin-top: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: var(--text-sm);
}
.right {
  color: var(--ok);
  font-weight: 600;
}
/* Phones: the number gives way to the text. */
@media (width < 600px) {
  .item {
    grid-template-columns: auto minmax(0, 1fr) auto;
    padding: var(--space-3);
  }
  .n {
    display: none;
  }
}
.points {
  padding-top: 4px;
  color: var(--text-2);
  font-family: var(--font-display);
  b {
    color: var(--text);
  }
}
.ok {
  color: var(--ok);
  &.status {
    background: var(--ok-tint);
  }
}
.danger {
  color: var(--danger);
  &.status {
    background: var(--danger-tint);
  }
}
.warn {
  color: var(--warn);
  &.status {
    background: var(--warn-tint);
  }
}
.accent {
  color: var(--accent-ink);
  &.status {
    background: var(--accent-tint);
  }
}
</style>
