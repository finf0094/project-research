<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'surface' | 'ink' | 'accent' | 'tint'; as?: string }>(), {
  tone: 'surface',
  as: 'section',
})
</script>

<template>
  <component :is="as" class="card" :class="tone"><slot /></component>
</template>

<style scoped>
.card {
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-1);
}
.surface {
  background: var(--surface);
}
.ink {
  background: var(--ink);
  color: var(--on-ink);
}
.accent {
  background: var(--accent);
  color: var(--on-accent);
}
.tint {
  background: var(--accent-tint);
  box-shadow: none;
}
</style>
