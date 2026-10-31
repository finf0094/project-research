<script setup lang="ts">
import { useId } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ label: string; hint?: string; error?: string }>()
const model = defineModel<string>({ required: true })
const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id">{{ label }}</label>
    <input
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :aria-invalid="!!error || undefined"
      :aria-describedby="error || hint ? `${id}-note` : undefined"
    />
    <p v-if="error || hint" :id="`${id}-note`" class="note" :class="{ error: !!error }">
      {{ error ?? hint }}
    </p>
  </div>
</template>

<style scoped>
.field {
  display: grid;
  gap: var(--space-2);
}
label {
  font-size: var(--text-sm);
  font-weight: 600;
}
input {
  min-height: 48px;
  padding: 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  transition:
    box-shadow 0.2s,
    background-color 0.2s;

  &:focus {
    outline: none;
    background: var(--surface);
    box-shadow: 0 0 0 4px var(--ring);
  }
  &[aria-invalid='true'] {
    border-color: var(--danger);
  }
}
.note {
  font-size: var(--text-xs);
  color: var(--text-2);
}
.error {
  color: var(--danger);
}
</style>
