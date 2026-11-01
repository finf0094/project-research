<script setup lang="ts">
import type { AnswerValue, Question } from '@exam/contracts'
import { computed } from 'vue'
import { StatusPill } from '@/shared/ui'
import ChoiceList from './ChoiceList.vue'
import TextAnswer from './TextAnswer.vue'

/** One question: its number, kind and points, the text and the answer. `scale`: the reading size. */
const props = withDefaults(
  defineProps<{ question: Question; index: number; value: AnswerValue | undefined; scale?: number }>(),
  { scale: 1 },
)
const emit = defineEmits<{ answer: [value: AnswerValue] }>()

const number = computed(() => String(props.index + 1).padStart(2, '0'))
</script>

<template>
  <article class="question" :aria-labelledby="`q-${question.id}`" :style="{ '--scale': scale }">
    <header class="meta">
      <span class="number" aria-hidden="true">{{ number }}</span>
      <StatusPill tone="accent">{{ $t(`exam.question.type.${question.type}`) }}</StatusPill>
      <span class="muted points">{{ $t('exam.question.points', { n: question.points }) }}</span>
      <slot name="tools" />
    </header>
    <h2 :id="`q-${question.id}`" class="text">{{ question.text }}</h2>

    <TextAnswer
      v-if="question.type === 'text'"
      :label="question.text"
      :model-value="typeof value === 'string' ? value : ''"
      @update:model-value="emit('answer', $event)"
    />
    <template v-else>
      <p class="muted how" aria-hidden="true">
        {{ $t(question.type === 'multiple' ? 'exam.question.chooseMany' : 'exam.question.chooseOne') }}
      </p>
      <ChoiceList
        :options="question.options"
        :multiple="question.type === 'multiple'"
        :labelledby="`q-${question.id}`"
        :model-value="value"
        @update:model-value="emit('answer', $event)"
      />
    </template>
  </article>
</template>

<style scoped>
.question {
  display: grid;
  gap: var(--space-4);
  /* Everything inside follows the student's reading size. */
  font-size: calc(var(--text-md) * var(--scale));
  /* Each question arrives with a short rise; the key on it makes every question a fresh entrance. */
  animation: rise var(--dur) var(--ease) both;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-block-end: var(--space-2);
  font-size: var(--text-md);
}
.number {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: 1;
  color: var(--accent);
}
.points {
  margin-inline-end: auto;
  font-size: var(--text-sm);
}
.how {
  margin-block-start: calc(-1 * var(--space-2));
  font-size: 0.85em;
}
.text {
  font-family: var(--font-sans);
  font-size: 1.4em;
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.35;
}
</style>
