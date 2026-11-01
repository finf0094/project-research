<script setup lang="ts">
import { AppLogo, LocaleSwitch } from '@/shared/ui'
import { useSections } from './sections'
import TabBar from './TabBar.vue'
import UserMenu from './UserMenu.vue'

/**
 * The student's frame. Wide screens: a light top bar (logo, sections, language, initials) above a centred
 * page. Phones: just the logo on top and the sections in a tab bar at the thumb, like a native app.
 */
const { sections, inSection } = useSections()
</script>

<template>
  <div class="shell">
    <header class="bar">
      <RouterLink to="/" class="home" :aria-label="$t('app.home')"><AppLogo /></RouterLink>
      <nav class="links" :aria-label="$t('app.nav.label')">
        <RouterLink
          v-for="item in sections.filter((s) => s.to !== '/profile')"
          :key="item.to"
          :to="item.to"
          class="link"
          :class="{ active: inSection(item.to) }"
          :aria-current="inSection(item.to) ? 'page' : undefined"
          >{{ $t(item.label) }}</RouterLink
        >
      </nav>
      <div class="tools">
        <LocaleSwitch variant="compact" />
        <UserMenu />
      </div>
    </header>
    <div class="content"><slot /></div>
    <TabBar />
  </div>
</template>

<style scoped>
.shell {
  width: min(1240px, 100%);
  margin-inline: auto;
  padding: max(var(--space-6), env(safe-area-inset-top)) var(--space-4) var(--space-12);
}
.bar {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding-block-end: var(--space-8);
}
.home {
  color: inherit;
  text-decoration: none;
}
.links {
  display: flex;
  gap: var(--space-1);
}
.link {
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  color: var(--text-2);
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color var(--dur-fast) var(--ease),
    color var(--dur-fast) var(--ease);
  &:hover {
    color: var(--text);
  }
  &.active {
    background: var(--surface);
    box-shadow: var(--shadow-1);
    color: var(--text);
  }
}
.tools {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-inline-start: auto;
}
/* Phones: sections, language and account live in the tab bar (Profile); the page keeps room above it. */
@media (width < 700px) {
  .shell {
    padding-block-end: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + var(--space-6));
  }
  .bar {
    padding-block-end: var(--space-5);
  }
  .links,
  .tools {
    display: none;
  }
}
</style>
