<script setup lang="ts">
import type { QuestionInput, QuestionType } from '@exam/contracts'
import { AppButton } from '@/shared/ui'
import { newQuestion } from '../draft'
import QuestionEditor from './QuestionEditor.vue'

/** The exam's questions in order: add, edit, move and remove. */
const model = defineModel<QuestionInput[]>({ required: true })
defineProps<{ disabled: boolean; oral: boolean }>()

const replace = (i: number, q: QuestionInput) => (model.value = model.value.map((x, j) => (j === i ? q : x)))
const add = (type: QuestionType) => (model.value = [...model.value, newQuestion(type)])
const remove = (i: number) => (model.value = model.value.filter((_, j) => j !== i))

function move(i: number, by: -1 | 1) {
  const next = [...model.value]
  ;[next[i], next[i + by]] = [next[i + by]!, next[i]!]
  model.value = next
}
</script>

<template>
  <section class="list">
    <h2>{{ $t('authoring.questions.title') }}</h2>
    <p v-if="oral" class="muted">{{ $t('authoring.questions.oralHint') }}</p>
    <QuestionEditor
      v-for="(q, i) in model"
      :key="i"
      :model-value="q"
      :index="i"
      :disabled="disabled"
      @update:model-value="replace(i, $event)"
    >
      <div v-if="!disabled" class="tools">
        <AppButton variant="ghost" :disabled="i === 0" @click="move(i, -1)"
          >↑ {{ $t('authoring.questions.up') }}</AppButton
        >
        <AppButton variant="ghost" :disabled="i === model.length - 1" @click="move(i, 1)">
          ↓ {{ $t('authoring.questions.down') }}
        </AppButton>
        <AppButton variant="ghost" :disabled="model.length === 1" @click="remove(i)">
          {{ $t('authoring.questions.remove') }}
        </AppButton>
      </div>
    </QuestionEditor>
    <div v-if="!disabled" class="add">
      <AppButton
        v-for="type in ['single', 'multiple', 'text'] as const"
        :key="type"
        variant="secondary"
        @click="add(type)"
      >
        + {{ $t(`exam.question.type.${type}`) }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.list,
.add,
.tools {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.list {
  flex-direction: column;
  gap: var(--space-4);
}
.tools {
  gap: var(--space-2);
}
</style>
