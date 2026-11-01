<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import StaffShell from './shell/StaffShell.vue'
import StudentShell from './shell/StudentShell.vue'

/** Each route says which frame it lives in; full-screen pages (exam, sign-in) have none. */
const auth = useAuthStore()
function shellOf(route: RouteLocationNormalizedLoaded) {
  const shell =
    route.meta.shell === 'auto' ? (auth.role === 'student' ? 'student' : 'staff') : route.meta.shell
  return shell === 'staff' ? StaffShell : shell === 'student' ? StudentShell : 'div'
}

/**
 * A new page (a different top-level route or parameters) is mounted afresh and rises in; tabs of the same
 * page (child routes) keep it mounted. The old page goes at once, so it never sees the next route.
 */
const pageKey = (route: RouteLocationNormalizedLoaded) =>
  (route.matched[0]?.path ?? route.path).replace(/:(\w+)/g, (_, name: string) => String(route.params[name]))
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="shellOf(route)">
      <div :key="pageKey(route)" class="route"><component :is="Component" /></div>
    </component>
  </RouterView>
</template>
