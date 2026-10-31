<script setup lang="ts">
import type { AnswerValue, Question } from '@exam/contracts'
import { computed } from 'vue'
import { ProgressRing } from '@/shared/ui'
import { isAnswered } from '../answers'

const props = defineProps<{ questions: Question[]; answers: Record<string, AnswerValue>; current: number }>()
const emit = defineEmits<{ select: [index: number] }>()

const answered = computed(() => props.questions.filter((q) => isAnswered(props.answers[q.id])).length)

function nextUnanswered() {
  const n = props.questions.length
  for (let step = 1; step <= n; step++) {
    const i = (props.current + step) % n
    if (!isAnswered(props.answers[props.questions[i]!.id])) return emit('select', i)
  }
}
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
      </div>
    </div>

    <ol class="grid">
      <li v-for="(q, i) in questions" :key="q.id">
        <button
          type="button"
          class="cell"
          :class="{ current: i === current, done: isAnswered(answers[q.id]) }"
          :aria-current="i === current ? 'step' : undefined"
          :aria-label="
            $t(isAnswered(answers[q.id]) ? 'exam.nav.questionAnswered' : 'exam.nav.question', { n: i + 1 })
          "
          @click="emit('select', i)"
        >
          {{ i + 1 }}
        </button>
      </li>
    </ol>
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
  font-weight: 600;
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.cell {
  width: 100%;
  aspect-ratio: 1;
  border: 0;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  font-weight: 600;
  transition:
    transform 0.14s var(--ease),
    background-color 0.2s;

  &:hover {
    transform: translateY(-2px);
  }
  &.done {
    background: var(--accent-tint);
    color: var(--accent-ink);
  }
  &.current {
    background: var(--accent);
    color: var(--on-accent);
  }
}
</style>
