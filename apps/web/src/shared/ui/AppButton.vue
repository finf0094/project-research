<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'lime' | 'ink' | 'ghost' | 'danger'
    type?: 'button' | 'submit'
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="button"
    :class="[variant, { block }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 48px;
  padding: 0 var(--space-6);
  border: 0;
  border-radius: var(--radius-pill);
  font-weight: 600;
  font-size: var(--text-md);
  transition:
    transform 0.16s var(--ease),
    background-color 0.2s,
    box-shadow 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: var(--shadow-2);
  }
  &:active:not(:disabled) {
    transform: scale(0.97);
    box-shadow: none;
  }
  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  &[aria-busy='true'] {
    cursor: progress;
  }
}

.block {
  width: 100%;
}

.primary {
  background: var(--accent);
  color: var(--on-accent);
  &:hover:not(:disabled) {
    background: color-mix(in oklab, var(--accent), black 10%);
  }
}
.secondary {
  background: var(--surface-2);
  color: var(--text);
}
.lime {
  background: var(--lime);
  color: var(--on-lime);
}
.ink {
  background: var(--ink);
  color: var(--on-ink);
}
.ghost {
  background: transparent;
  color: var(--text);
  &:hover:not(:disabled) {
    background: var(--surface-2);
    box-shadow: none;
  }
}
.danger {
  background: var(--danger-tint);
  color: var(--danger);
}
</style>
