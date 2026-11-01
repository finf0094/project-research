<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

/**
 * One choice out of a few, each explained in a line (an exam's format, how it is recorded): cards a
 * person compares at a glance, where a select would hide the alternatives. A radio group underneath.
 */
defineProps<{
  label: string
  items: { value: T; title: string; text: string; icon: Component }[]
  disabled?: boolean
}>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <fieldset class="cards" :disabled="disabled">
    <legend>{{ label }}</legend>
    <label v-for="item in items" :key="item.value" class="card">
      <input v-model="model" class="visually-hidden" type="radio" :value="item.value" />
      <component :is="item.icon" class="icon" :size="20" aria-hidden="true" />
      <span class="title">{{ item.title }}</span>
      <span class="text">{{ item.text }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px var(--space-2);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  cursor: pointer;
  transition:
    border-color var(--dur-fast) var(--ease),
    background-color var(--dur-fast) var(--ease);
  &:hover {
    border-color: var(--accent);
  }
  &:has(input:checked) {
    border-color: var(--accent);
    background: var(--accent-tint);
  }
  &:has(input:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  fieldset:disabled & {
    cursor: not-allowed;
    opacity: 0.6;
  }
}
.icon {
  color: var(--accent-ink);
}
.title {
  font-weight: 700;
}
.text {
  grid-column: 2;
  color: var(--text-2);
  font-size: var(--text-xs);
  line-height: 1.4;
}
</style>
