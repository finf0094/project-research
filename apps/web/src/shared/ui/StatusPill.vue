<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'ok' | 'warn' | 'off' | 'accent' | 'danger' | 'lime'; dot?: boolean }>(), {
  tone: 'off',
})
</script>

<template>
  <span class="pill" :class="tone">
    <span v-if="dot" class="dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}
.ok {
  background: var(--ok-tint);
  color: var(--ok);
}
.warn {
  background: var(--warn-tint);
  color: var(--warn);
}
.off {
  background: var(--off-tint);
  color: var(--off);
}
.accent {
  background: var(--accent-tint);
  color: var(--accent-ink);
}
.danger {
  background: var(--danger-tint);
  color: var(--danger);
}
.lime {
  background: var(--lime);
  color: var(--on-lime);
}
</style>
