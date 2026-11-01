<script setup lang="ts">
import type { Option } from '@exam/contracts'
import { useId } from 'vue'

const props = defineProps<{
  options: Option[]
  multiple: boolean
  modelValue: string | string[] | undefined
  /** Id of the element with the question text, so a screen reader names the group by the question. */
  labelledby?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string | string[]] }>()
const name = useId()

const LETTERS = 'ABCDEFGHIJ'
const isChecked = (id: string) =>
  Array.isArray(props.modelValue) ? props.modelValue.includes(id) : props.modelValue === id

function toggle(id: string) {
  if (!props.multiple) return emit('update:modelValue', id)
  const selected = Array.isArray(props.modelValue) ? props.modelValue : []
  emit('update:modelValue', isChecked(id) ? selected.filter((s) => s !== id) : [...selected, id])
}
</script>

<template>
  <!-- Native radios/checkboxes inside labels: keyboard and screen readers work without extra code. -->
  <fieldset class="choices" :aria-labelledby="labelledby ? `${labelledby} ${name}-how` : undefined">
    <legend :id="`${name}-how`" class="visually-hidden">
      {{ $t(multiple ? 'exam.question.chooseMany' : 'exam.question.chooseOne') }}
    </legend>
    <label
      v-for="(option, i) in options"
      :key="option.id"
      class="option"
      :class="{ checked: isChecked(option.id) }"
    >
      <input
        class="visually-hidden"
        :type="multiple ? 'checkbox' : 'radio'"
        :name="name"
        :value="option.id"
        :checked="isChecked(option.id)"
        @change="toggle(option.id)"
      />
      <span class="letter" aria-hidden="true">{{ LETTERS[i] }}</span>
      <span>{{ option.text }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.choices {
  display: grid;
  /* At most two columns: four options read as a 2×2 grid, never 3 + 1. */
  grid-template-columns: repeat(auto-fit, minmax(max(240px, 40%), 1fr));
  gap: var(--space-3);
  padding: 0;
  border: 0;
}
.option {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 64px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 0.22s var(--ease),
    color 0.22s,
    transform 0.16s var(--ease);

  &:hover {
    transform: translateY(-2px);
  }
  &:has(:focus-visible) {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
  &.checked {
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: var(--shadow-2);
  }
}
.letter {
  display: grid;
  place-items: center;
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text);
  font-family: var(--font-display);
  font-size: var(--text-sm);

  .checked & {
    background: var(--lime);
    color: var(--on-lime);
  }
}
</style>
