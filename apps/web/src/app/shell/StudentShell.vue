<script setup lang="ts">
import { AppLogo, LocaleSwitch } from '@/shared/ui'
import UserMenu from './UserMenu.vue'

/** The student's frame: a light top bar (logo, language, initials) above a centred page. */
</script>

<template>
  <div class="shell">
    <header class="bar">
      <RouterLink to="/" class="home" :aria-label="$t('app.home')"><AppLogo /></RouterLink>
      <div class="tools">
        <LocaleSwitch variant="compact" />
        <UserMenu />
      </div>
    </header>
    <div class="content"><slot /></div>
  </div>
</template>

<style scoped>
.shell {
  width: min(1240px, 100%);
  margin-inline: auto;
  padding: var(--space-6) var(--space-4) var(--space-12);
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-block-end: var(--space-8);
}
.home {
  color: inherit;
  text-decoration: none;
}
.tools {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
