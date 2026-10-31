<script setup lang="ts">
import type { AnswerValue, Question } from '@exam/contracts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ProgressRing } from '@/shared/ui'
import { isAnswered } from '../answers'
import { TYPE_ICON } from '../question-types'

/** Every question at a glance: answered, current and marked ones, and a jump to the next unanswered. */
const props = defineProps<{
  questions: Question[]
  answers: Record<string, AnswerValue>
  current: number
  flagged: string[]
}>()
const emit = defineEmits<{ select: [index: number] }>()

const { t } = useI18n()
const done = (q: Question) => isAnswered(props.answers[q.id])
const answered = computed(() => props.questions.filter(done).length)

function nextUnanswered() {
  const n = props.questions.length
  for (let step = 1; step <= n; step++) {
    const i = (props.current + step) % n
    if (!done(props.questions[i]!)) return emit('select', i)
  }
}
const label = (q: Question, i: number) =>
  [
    t(done(q) ? 'exam.nav.questionAnswered' : 'exam.nav.question', { n: i + 1 }),
    props.flagged.includes(q.id) ? t('exam.nav.flagged') : '',
  ]
    .filter(Boolean)
    .join(', ')
</script>

<template>
  <nav class="nav" :aria-label="$t('exam.nav.label')">
    <div class="progress">
      <ProgressRing :value="answered" :max="questions.length" />
      <div>
        <p class="label">{{ $t('exam.nav.answered') }}</p>
        <button v-if="answered < questions.length" type="button" class="link" @click="nextUnanswered">
          {{ $t('exam.nav.nextUnanswered') }}
        </button>
        <p v-else class="all">{{ $t('exam.nav.all') }}</p>
      </div>
    </div>

    <ol class="grid">
      <li v-for="(q, i) in questions" :key="q.id">
        <button
          type="button"
          class="cell"
          :class="{ current: i === current, done: done(q), flagged: flagged.includes(q.id) }"
          :aria-current="i === current ? 'step' : undefined"
          :aria-label="label(q, i)"
          @click="emit('select', i)"
        >
          <span class="n">{{ i + 1 }}</span>
          <component :is="TYPE_ICON[q.type]" :size="12" aria-hidden="true" />
        </button>
      </li>
    </ol>

    <ul class="legend" aria-hidden="true">
      <li><span class="key done" />{{ $t('exam.nav.legend.answered') }}</li>
      <li><span class="key" />{{ $t('exam.nav.legend.empty') }}</li>
      <li><span class="key flag" />{{ $t('exam.nav.legend.flagged') }}</li>
    </ul>
  </nav>
</template>

<style scoped>
.nav {
  display: grid;
  gap: var(--space-5);
}
.progress {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.label {
  font-weight: 700;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-ink);
  font-size: var(--text-sm);
  font-weight: 600;
  text-align: start;
}
.all {
  color: var(--ok);
  font-size: var(--text-sm);
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.cell {
  position: relative;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 2px;
  inline-size: 100%;
  aspect-ratio: 1;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  transition:
    translate var(--dur-fast) var(--ease),
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
  &:hover {
    translate: 0 -2px;
  }
  &.done {
    background: var(--accent-tint);
    color: var(--accent-ink);
  }
  &.current {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: var(--shadow-2);
  }
  /* A marked question: a peach dot in the corner, popping in when set. */
  &.flagged::after {
    content: '';
    position: absolute;
    inset: 5px 5px auto auto;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--warn);
    animation: pop var(--dur) var(--ease-spring);
  }
}
.n {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 700;
  line-height: 1;
}
@keyframes pop {
  from {
    scale: 0;
  }
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  padding: 0;
  color: var(--text-2);
  font-size: var(--text-xs);
  list-style: none;
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
}
.key {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 3px;
  background: var(--surface-2);
  &.done {
    background: var(--accent-tint);
  }
  &.flag {
    border-radius: 50%;
    background: var(--warn);
  }
}
</style>
