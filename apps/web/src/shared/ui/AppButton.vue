<script setup lang="ts">
import { ArrowRight, Plus } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'lime' | 'ink' | 'ghost' | 'danger'
    /** A trailing round icon (the mockup's call-to-action style): it nudges forward on hover. */
    icon?: 'arrow' | 'plus'
    /** Makes it a link (navigation styled as a button). */
    to?: string
    type?: 'button' | 'submit'
    block?: boolean
    loading?: boolean
    disabled?: boolean
  }>(),
  { variant: 'primary', type: 'button' },
)
</script>

<template>
  <RouterLink v-if="to" :to="to" class="button" :class="[variant, { block }]">
    <slot />
    <span v-if="icon" class="chip" aria-hidden="true">
      <ArrowRight v-if="icon === 'arrow'" :size="18" />
      <Plus v-else :size="18" />
    </span>
  </RouterLink>
  <button
    v-else
    :type="type"
    class="button"
    :class="[variant, { block }]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <slot />
    <span v-if="icon" class="chip" aria-hidden="true">
      <ArrowRight v-if="icon === 'arrow'" :size="18" />
      <Plus v-else :size="18" />
    </span>
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  text-decoration: none;
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

/* Trailing icon chip: a circle a shade darker than the button; padding shrinks so it sits at the edge. */
.button:has(.chip) {
  padding-inline-end: var(--space-1);
  gap: var(--space-3);
}
.chip {
  display: grid;
  place-items: center;
  inline-size: 40px;
  block-size: 40px;
  border-radius: 50%;
  background: color-mix(in oklab, currentColor 16%, transparent);
  transition: translate var(--dur) var(--ease-spring);
}
.lime .chip {
  background: var(--ink);
  color: var(--lime);
}
.button:hover:not(:disabled) .chip {
  translate: 3px 0;
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
