<script setup lang="ts">
import { useSections } from './sections'

/**
 * The phone's tab bar, as in a native app: the role's sections at the thumb, above the home indicator.
 * Wider screens keep the sidebar or the top bar instead.
 */
const { sections, inSection } = useSections()
</script>

<template>
  <nav class="tabbar" :aria-label="$t('app.nav.label')">
    <RouterLink
      v-for="item in sections"
      :key="item.to"
      :to="item.to"
      class="tab press"
      :class="{ active: inSection(item.to) }"
      :aria-current="inSection(item.to) ? 'page' : undefined"
    >
      <span class="icon"><component :is="item.icon" :size="22" aria-hidden="true" /></span>
      <span class="label">{{ $t(item.label) }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  z-index: 20;
  inset: auto 0 0;
  display: none;
  grid-auto-columns: minmax(0, 1fr);
  grid-auto-flow: column;
  padding: var(--space-2) var(--space-2) max(var(--space-2), env(safe-area-inset-bottom));
  border-top: 1px solid var(--border);
  background: color-mix(in oklab, var(--surface) 82%, transparent);
  backdrop-filter: blur(18px) saturate(1.6);
}
.tab {
  display: grid;
  min-inline-size: 0;
  justify-items: center;
  gap: 2px;
  min-block-size: 52px;
  padding-block: var(--space-1);
  color: var(--text-2);
  font-size: var(--text-xs);
  font-weight: 600;
  text-decoration: none;
}
/* The active tab's icon sits on a pill that grows in with a little spring. */
.icon {
  display: grid;
  place-items: center;
  inline-size: 56px;
  block-size: 30px;
  border-radius: var(--radius-pill);
  transition:
    background-color var(--dur) var(--ease),
    scale var(--dur) var(--ease-spring);
}
.active {
  color: var(--text);
  .icon {
    background: var(--accent-tint);
    color: var(--accent-ink);
    scale: 1.04;
  }
}
@media (width < 700px) {
  .tabbar {
    display: grid;
  }
}
</style>
