<script setup lang="ts">
import type { QuestionInput } from '@exam/contracts'
import { Check, X } from 'lucide-vue-next'
import { nextOptionId } from '../draft'

/** A choice question's options: their texts, which are correct (one or several), adding and removing. */
const model = defineModel<QuestionInput>({ required: true })
defineProps<{ index: number }>()

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
  <div class="options" role="group" :aria-labelledby="`options-${index}`">
    <p :id="`options-${index}`" class="field-label">
      {{ $t(model.type === 'single' ? 'authoring.questions.markOne' : 'authoring.questions.markMany') }}
    </p>
    <TransitionGroup name="list" tag="div" class="option-list">
      <div v-for="(option, i) in model.options" :key="option.id" class="option">
        <label class="correct" :class="{ on: model.correct.includes(option.id) }">
          <input
            class="visually-hidden"
            :type="model.type === 'single' ? 'radio' : 'checkbox'"
            :name="`correct-${index}`"
            :checked="model.correct.includes(option.id)"
            @change="toggleCorrect(option.id, ($event.target as HTMLInputElement).checked)"
          />
          <Check :size="16" aria-hidden="true" />
          <span class="visually-hidden">{{ $t('authoring.questions.correctFor', { n: i + 1 }) }}</span>
        </label>
        <input
          class="text"
          :value="option.text"
          :aria-label="$t('authoring.questions.option', { n: i + 1 })"
          maxlength="1000"
          @input="setOptionText(option.id, ($event.target as HTMLInputElement).value)"
        />
        <button
          type="button"
          class="icon"
          :disabled="model.options.length <= 2"
          :aria-label="$t('authoring.questions.removeOption')"
          @click="removeOption(option.id)"
        >
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>
    <button type="button" class="link" :disabled="model.options.length >= 12" @click="addOption">
      + {{ $t('authoring.questions.addOption') }}
    </button>
  </div>
</template>

<style scoped>
.options,
.option-list {
  position: relative;
  display: grid;
  gap: var(--space-2);
}
.option {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2);
}
.correct {
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  border: 2px solid var(--border);
  border-radius: 50%;
  color: transparent;
  cursor: pointer;
  transition:
    background-color var(--dur) var(--ease),
    border-color var(--dur) var(--ease),
    scale var(--dur-fast) var(--ease-spring);
  &.on {
    border-color: var(--ok);
    background: var(--ok);
    color: var(--on-ok);
    scale: 1.05;
  }
  &:has(:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
}
.icon {
  display: grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  border: 0;
  border-radius: 50%;
  background: none;
  color: var(--text-2);
  &:hover:not(:disabled) {
    background: var(--danger-tint);
    color: var(--danger);
  }
}
.link {
  justify-self: start;
  border: 0;
  background: none;
  color: var(--accent-ink);
  font-weight: 600;
}
.field-label {
  font-size: var(--text-sm);
  font-weight: 600;
}
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
</style>
