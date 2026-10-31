<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import StaffShell from './shell/StaffShell.vue'
import StudentShell from './shell/StudentShell.vue'

/** Each route says which frame it lives in; full-screen pages (exam, sign-in) have none. */
const shellOf = (route: RouteLocationNormalizedLoaded) =>
  route.meta.shell === 'staff' ? StaffShell : route.meta.shell === 'student' ? StudentShell : 'div'
</script>

<template>
  <RouterView v-slot="{ Component, route }">
    <component :is="shellOf(route)">
      <Transition name="page" mode="out-in">
        <div :key="route.path" class="route"><component :is="Component" /></div>
      </Transition>
    </component>
  </RouterView>
</template>
