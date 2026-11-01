<script setup lang="ts" generic="T extends string">
/**
 * A row of pill buttons choosing one value (filters like "All / Running / To review"), each with an
 * optional count. The chosen pill is ink; the highlight glides between pills.
 */
defineProps<{ items: { value: T; label: string; count?: number }[]; label: string }>()
const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="tabs" role="group" :aria-label="label">
    <button
      v-for="item in items"
      :key="item.value"
      type="button"
      class="tab"
      :aria-pressed="model === item.value"
      @click="model = item.value"
    >
      {{ item.label }}
      <span v-if="item.count !== undefined" class="count">{{ item.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 40px;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--text-2);
  font-weight: 600;
  font-size: var(--text-sm);
  white-space: nowrap;
  flex: none;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);

  &:hover {
    color: var(--text);
  }
  &[aria-pressed='true'] {
    background: var(--ink);
    color: var(--on-ink);
  }
}
.count {
  min-inline-size: 22px;
  padding: 1px 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, currentColor 14%, transparent);
  font-size: var(--text-xs);
  text-align: center;
}
/* Phones: one full-width row that scrolls sideways, never a wrapped pill-shaped blob. The containment
   keeps the long row from widening the page. */
@media (width < 600px) {
  .tabs {
    display: flex;
    flex-wrap: nowrap;
    inline-size: 100%;
    contain: inline-size;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
}
</style>
