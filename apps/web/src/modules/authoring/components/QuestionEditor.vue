<script setup lang="ts">
import type { QuestionInput, QuestionType } from '@exam/contracts'
import { Trash2 } from 'lucide-vue-next'
import { useFields } from '@/shared/lib/fields'
import { changeType, nextOptionId } from '../draft'

/** One question: its type, text, points and, for choice questions, the options with the correct ones. */
const model = defineModel<QuestionInput>({ required: true })
/** `oral`: open questions only, so the type is fixed. */
defineProps<{ index: number; disabled: boolean; oral: boolean }>()
const field = useFields(model)
const text = field('text')
const points = field('points')

const setType = (type: QuestionType) => (model.value = changeType(model.value, type))
const setOptionText = (id: string, value: string) =>
  (model.value = {
    ...model.value,
    options: model.value.options.map((o) => (o.id === id ? { ...o, text: value } : o)),
  })

function toggleCorrect(id: string, on: boolean) {
  const others = model.value.type === 'single' ? [] : model.value.correct.filter((c) => c !== id)
  model.value = { ...model.value, correct: on ? [...others, id] : others }
}

function addOption() {
  const id = nextOptionId(model.value.options.map((o) => o.id))
  model.value = { ...model.value, options: [...model.value.options, { id, text: '' }] }
}

function removeOption(id: string) {
  model.value = {
    ...model.value,
    options: model.value.options.filter((o) => o.id !== id),
    correct: model.value.correct.filter((c) => c !== id),
  }
}
</script>

<template>
  <fieldset class="question" :disabled="disabled">
    <legend>{{ $t('authoring.questions.number', { n: index + 1 }) }}</legend>
    <div class="row">
      <label v-if="!oral">
        {{ $t('authoring.questions.type') }}
        <select
          :value="model.type"
          @change="setType(($event.target as HTMLSelectElement).value as QuestionType)"
        >
          <option v-for="type in ['single', 'multiple', 'text'] as const" :key="type" :value="type">
            {{ $t(`exam.question.type.${type}`) }}
          </option>
        </select>
      </label>
      <label>
        {{ $t('authoring.questions.points') }}
        <input v-model.number="points" type="number" min="1" max="100" required />
      </label>
    </div>
    <label>
      {{ $t('authoring.questions.text') }}
      <textarea v-model="text" rows="2" maxlength="5000" required />
    </label>

    <div
      v-if="model.type !== 'text'"
      class="options"
      role="group"
      :aria-label="$t('authoring.questions.options')"
    >
      <div v-for="(option, i) in model.options" :key="option.id" class="option">
        <input
          :type="model.type === 'single' ? 'radio' : 'checkbox'"
          :name="`correct-${index}`"
          :checked="model.correct.includes(option.id)"
          :aria-label="$t('authoring.questions.correctFor', { n: i + 1 })"
          @change="toggleCorrect(option.id, ($event.target as HTMLInputElement).checked)"
        />
        <input
          :value="option.text"
          :aria-label="$t('authoring.questions.option', { n: i + 1 })"
          maxlength="1000"
          required
          @input="setOptionText(option.id, ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="icon"
          :disabled="model.options.length <= 2"
          :aria-label="$t('authoring.questions.removeOption')"
          @click="removeOption(option.id)"
        >
          <Trash2 :size="18" />
        </button>
      </div>
      <button type="button" class="link" :disabled="model.options.length >= 12" @click="addOption">
        + {{ $t('authoring.questions.addOption') }}
      </button>
    </div>
    <slot />
  </fieldset>
</template>

<style scoped>
.question {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
legend {
  padding-inline: var(--space-2);
  font-weight: 600;
}
.row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: var(--space-3);
}
label {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.options {
  display: grid;
  gap: var(--space-2);
}
.option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2);

  input[type='radio'],
  input[type='checkbox'] {
    accent-color: var(--accent);
    inline-size: 20px;
    block-size: 20px;
  }
}
.icon {
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-2);
  cursor: pointer;
}
.link {
  justify-self: start;
  border: 0;
  background: none;
  color: var(--accent);
  font-weight: 600;
  cursor: pointer;
}
</style>
