<script setup lang="ts">
import type { AnswerValue, Question } from '@exam/contracts'
import { computed } from 'vue'
import { StatusPill } from '@/shared/ui'
import ChoiceList from './ChoiceList.vue'
import TextAnswer from './TextAnswer.vue'

const props = defineProps<{ question: Question; index: number; value: AnswerValue | undefined }>()
const emit = defineEmits<{ answer: [value: AnswerValue] }>()

const TYPE_LABEL = {
  single: 'Один вариант',
  multiple: 'Несколько вариантов',
  text: 'Развёрнутый ответ',
} as const
const number = computed(() => String(props.index + 1).padStart(2, '0'))
</script>

<template>
  <article class="question" :aria-labelledby="`q-${question.id}`">
    <header class="meta">
      <span class="number" aria-hidden="true">{{ number }}</span>
      <StatusPill tone="accent">{{ TYPE_LABEL[question.type] }}</StatusPill>
      <span class="muted points">{{ question.points }} б.</span>
    </header>
    <h2 :id="`q-${question.id}`" class="text">{{ question.text }}</h2>

    <TextAnswer
      v-if="question.type === 'text'"
      :key="question.id"
      :label="question.text"
      :model-value="typeof value === 'string' ? value : undefined"
      @update:model-value="emit('answer', $event)"
    />
    <ChoiceList
      v-else
      :options="question.options"
      :multiple="question.type === 'multiple'"
      :model-value="value"
      @update:model-value="emit('answer', $event)"
    />
  </article>
</template>

<style scoped>
.question {
  display: grid;
  gap: var(--space-5);
}
.meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.number {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: 1;
  color: var(--accent);
}
.points {
  margin-inline-start: auto;
  font-size: var(--text-sm);
}
.text {
  font-family: var(--font-sans);
  font-size: var(--text-xl);
  font-weight: 600;
  letter-spacing: 0;
  line-height: 1.35;
}
</style>
