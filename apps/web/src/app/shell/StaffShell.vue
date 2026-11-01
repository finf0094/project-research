<script setup lang="ts">
import { FileText, SlidersHorizontal, Users } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { AppLogo, LocaleSwitch } from '@/shared/ui'
import UserMenu from './UserMenu.vue'

/**
 * The examiner's and administrator's frame: a dark sidebar with the sections of their role, the page
 * beside it. On narrow screens the sidebar becomes a bar on top.
 */
const auth = useAuthStore()
const route = useRoute()
/** A section stays highlighted on its sub-pages (an exam, an attempt, the editor). */
const inSection = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
const nav = computed(() =>
  auth.role === 'admin'
    ? [{ to: '/admin', label: 'app.nav.users', icon: Users }]
    : [
        { to: '/examiner', label: 'app.nav.exams', icon: FileText },
        { to: '/calibration', label: 'app.nav.calibration', icon: SlidersHorizontal },
      ],
)
</script>

<template>
  <div class="shell">
    <div class="side">
      <RouterLink to="/" class="home" :aria-label="$t('app.home')"><AppLogo inverted /></RouterLink>
      <nav :aria-label="$t('app.nav.label')">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="item"
          :class="{ active: inSection(item.to) }"
          :aria-current="route.path === item.to ? 'page' : inSection(item.to) ? 'true' : undefined"
        >
          <component :is="item.icon" :size="20" aria-hidden="true" />
          <span class="label">{{ $t(item.label) }}</span>
        </RouterLink>
      </nav>
      <div class="foot">
        <LocaleSwitch variant="compact" />
        <UserMenu />
      </div>
    </div>
    <div class="content"><slot /></div>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: var(--space-6);
  min-height: 100dvh;
  padding: var(--space-4);
}
.side {
  position: sticky;
  top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  block-size: calc(100dvh - 2 * var(--space-4));
  padding: var(--space-6) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
.home {
  padding-inline: var(--space-2);
  color: inherit;
  text-decoration: none;
}
nav {
  display: grid;
  gap: var(--space-2);
}
.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-block-size: 48px;
  padding: 0 var(--space-4);
  border-radius: var(--radius);
  color: var(--on-ink-2);
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
  &:hover {
    background: var(--on-ink-tint);
    color: var(--on-ink);
  }
  &.active {
    background: var(--lime);
    color: var(--on-lime);
  }
}
.foot {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: auto;
}
.content {
  min-inline-size: 0;
  padding-block: var(--space-4) var(--space-12);
}
@media (width < 900px) {
  /* A top bar: logo and account on the first row, the sections as labelled pills below. */
  .shell {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: var(--space-4);
    padding: var(--space-3);
  }
  .side {
    position: static;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-3);
    block-size: auto;
    padding: var(--space-3);
  }
  nav {
    grid-column: 1 / -1;
    grid-row: 2;
    display: flex;
    contain: inline-size;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .item {
    flex: none;
    min-block-size: 40px;
    border-radius: var(--radius-pill);
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .foot {
    margin: 0;
  }
  .content {
    padding-block: 0 var(--space-12);
  }
}
</style>
