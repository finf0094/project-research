<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: string | undefined; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const text = ref(props.modelValue ?? '')

// Typing is saved after a short pause and on blur: every save is a sealed event, so not one per keystroke.
const save = useDebounceFn(() => emit('update:modelValue', text.value), 800)
const flush = () => {
  if (text.value !== (props.modelValue ?? '')) emit('update:modelValue', text.value)
}

watch(
  () => props.modelValue,
  (value) => {
    if (value !== undefined && value !== text.value) text.value = value
  },
)
</script>

<template>
  <label class="answer">
    <span class="visually-hidden">{{ label }}</span>
    <textarea v-model="text" rows="6" placeholder="Ваш ответ" maxlength="20000" @input="save" @blur="flush" />
  </label>
</template>

<style scoped>
textarea {
  display: block;
  width: 100%;
  min-height: 200px;
  field-sizing: content;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  line-height: 1.6;
  resize: vertical;

  &:focus {
    outline: none;
    background: var(--surface);
    box-shadow: 0 0 0 4px var(--ring);
  }
}
</style>
