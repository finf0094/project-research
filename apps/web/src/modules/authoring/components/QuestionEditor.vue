<script setup lang="ts">
import type { QuestionInput, QuestionType } from '@exam/contracts'
import { useFields } from '@/shared/lib/fields'
import { changeType } from '../draft'
import OptionsEditor from './OptionsEditor.vue'

/** One question: its type, text, points and, for choice questions, the options with the correct ones. */
const model = defineModel<QuestionInput>({ required: true })
/** `oral`: open questions only, so the type is fixed. */
defineProps<{ index: number; disabled: boolean; oral: boolean }>()
const field = useFields(model)
const text = field('text')
const points = field('points')

const setType = (type: QuestionType) => (model.value = changeType(model.value, type))
</script>

<template>
  <fieldset class="question" :disabled="disabled">
    <legend class="visually-hidden">{{ $t('authoring.questions.number', { n: index + 1 }) }}</legend>
    <header class="head">
      <span class="number" aria-hidden="true">{{ String(index + 1).padStart(2, '0') }}</span>
      <label v-if="!oral" class="type">
        <span class="visually-hidden">{{ $t('authoring.questions.type') }}</span>
        <select
          :value="model.type"
          @change="setType(($event.target as HTMLSelectElement).value as QuestionType)"
        >
          <option v-for="type in ['single', 'multiple', 'text'] as const" :key="type" :value="type">
            {{ $t(`exam.question.type.${type}`) }}
          </option>
        </select>
      </label>
      <label class="points">
        <input v-model.number="points" type="number" min="1" max="100" />
        <span>{{ $t('authoring.questions.pointsShort') }}</span>
      </label>
      <span class="tools"><slot name="tools" /></span>
    </header>

    <label class="field">
      {{ $t('authoring.questions.text') }}
      <textarea v-model="text" rows="3" maxlength="5000" />
    </label>

    <OptionsEditor v-if="model.type !== 'text'" v-model="model" :index="index" />
  </fieldset>
</template>

<style scoped>
.question {
  display: grid;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  border: 0;
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.number {
  margin-inline-end: var(--space-2);
  color: var(--accent);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  line-height: 1;
}
.type select,
.points {
  block-size: 36px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--accent-tint);
  color: var(--accent-ink);
  font-size: var(--text-sm);
  font-weight: 600;
}
.type select {
  padding: 0 var(--space-3);
}
.points {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0 var(--space-3) 0 var(--space-1);
  background: var(--surface-2);
  color: var(--text);
  input {
    inline-size: 36px;
    border: 0;
    background: none;
    font-weight: 700;
    text-align: center;
  }
}
.tools {
  display: flex;
  gap: var(--space-1);
  margin-inline-start: auto;
  :slotted(button) {
    display: grid;
    place-items: center;
    inline-size: 36px;
    block-size: 36px;
    border: 0;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--text-2);
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease);
    &:hover:not(:disabled) {
      color: var(--text);
    }
    &.danger:hover:not(:disabled) {
      background: var(--danger-tint);
      color: var(--danger);
    }
  }
}
.field,
.field-label {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
textarea,
.text {
  padding: var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: var(--surface-2);
  font-weight: 500;
  &:focus {
    border-color: var(--accent);
    outline: none;
    background: var(--surface);
  }
}
textarea {
  font-size: var(--text-md);
  resize: vertical;
}
</style>
