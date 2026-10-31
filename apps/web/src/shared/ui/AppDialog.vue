<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()

// The native <dialog> gives focus trapping, Esc handling and an accessible modal for free.
watch(
  () => props.open,
  (open) => {
    if (open && !dialog.value?.open) dialog.value?.showModal()
    if (!open && dialog.value?.open) dialog.value.close()
  },
  { flush: 'post' },
)
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-label="title" @close="emit('close')">
    <h2 class="title">{{ title }}</h2>
    <slot />
    <footer v-if="$slots.actions" class="actions"><slot name="actions" /></footer>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(480px, calc(100vw - 32px));
  padding: var(--space-8);
  border: 0;
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-2);

  &::backdrop {
    background: var(--scrim);
  }
  &[open] {
    animation: rise 0.3s var(--ease);
  }
}
.title {
  margin-bottom: var(--space-3);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
}
</style>
