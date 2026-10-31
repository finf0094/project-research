<script setup lang="ts">
defineProps<{ label: string }>()
// The store decides when typed text becomes a sealed event (after a pause, on blur, before finishing).
const model = defineModel<string>({ default: '' })
</script>

<template>
  <label class="answer">
    <span class="visually-hidden">{{ label }}</span>
    <textarea v-model="model" rows="6" :placeholder="$t('exam.question.placeholder')" maxlength="20000" />
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
