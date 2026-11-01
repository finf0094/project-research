<script setup lang="ts">
import type { Component } from 'vue'

/** An icon in a soft rounded square, as in the mockup's check lists and alert feed. */
withDefaults(
  defineProps<{ icon: Component; tone?: 'sky' | 'peach' | 'lime' | 'accent' | 'danger' | 'ok' | 'ink' }>(),
  {
    tone: 'sky',
  },
)
</script>

<template>
  <span class="tile" :class="tone" aria-hidden="true"><component :is="icon" :size="18" /></span>
</template>

<style scoped>
.tile {
  display: inline-grid;
  flex: none;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  border-radius: var(--radius-sm);
}
.sky {
  background: var(--sky);
  color: var(--on-sky);
}
.peach {
  background: var(--peach);
  color: var(--on-peach);
}
.lime {
  background: var(--lime-tint);
  color: var(--ok);
}
.accent {
  background: var(--accent-tint);
  color: var(--accent-ink);
}
.danger {
  background: var(--danger-tint);
  color: var(--danger);
}
.ok {
  background: var(--ok-tint);
  color: var(--ok);
}
.ink {
  background: var(--on-ink-tint);
  color: var(--on-ink);
}
</style>
