<script setup lang="ts">
import { onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const titleId = useId()

// The native <dialog> gives focus trapping, Esc handling and an accessible modal for free.
function sync(open: boolean) {
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}
// Mounted already open (a message waiting when the page appears): the element exists only from here.
onMounted(() => sync(props.open))
watch(() => props.open, sync, { flush: 'post' })

// A tap on the dimmed backdrop dismisses it, as a sheet does (the dialog's own padding is not the backdrop).
function onClick(event: MouseEvent) {
  const box = dialog.value?.getBoundingClientRect()
  if (!box || event.target !== dialog.value) return
  const inside =
    event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom
  if (!inside) dialog.value?.close()
}
</script>

<template>
  <dialog ref="dialog" class="dialog" :aria-labelledby="titleId" @close="emit('close')" @click="onClick">
    <h2 :id="titleId" class="title">{{ title }}</h2>
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
    animation: veil var(--dur) var(--ease);
  }
  &[open] {
    animation: rise var(--dur) var(--ease);
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
/*
 * Phones: a bottom sheet, as in a native app. It slides up from the bottom edge with a grabber on top, clears
 * the home indicator, and its buttons span the width within reach of the thumb.
 */
@media (width < 700px) {
  .dialog {
    inline-size: 100%;
    max-inline-size: 100%;
    max-block-size: calc(100dvh - max(var(--space-8), env(safe-area-inset-top)));
    margin: auto 0 0;
    padding: var(--space-6) var(--space-5) max(var(--space-5), env(safe-area-inset-bottom));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    &::before {
      content: '';
      display: block;
      inline-size: 40px;
      block-size: 5px;
      margin: calc(-1 * var(--space-3)) auto var(--space-4);
      border-radius: var(--radius-pill);
      background: var(--border);
    }
    &[open] {
      animation: sheet var(--dur) var(--ease);
    }
  }
  .actions {
    flex-direction: column-reverse;
    > * {
      inline-size: 100%;
    }
  }
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.98);
  }
}
@keyframes sheet {
  from {
    transform: translateY(100%);
  }
}
@keyframes veil {
  from {
    opacity: 0;
  }
}
</style>
