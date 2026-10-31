<script setup lang="ts">
import { CircleAlert, CircleCheck } from 'lucide-vue-next'

export interface CheckItem {
  id: string
  ok: boolean
  title: string
  /** Advice shown under the title; omitted when there is nothing to do. */
  hint?: string
}

/** A list of passed / failed checks with advice, as on the preflight page. */
defineProps<{ items: CheckItem[] }>()
</script>

<template>
  <ul class="checks">
    <li v-for="item in items" :key="item.id" class="check">
      <CircleCheck v-if="item.ok" class="ok" :size="22" aria-hidden="true" />
      <CircleAlert v-else class="bad" :size="22" aria-hidden="true" />
      <div>
        <p class="title">{{ item.title }}</p>
        <p v-if="item.hint" class="muted hint">{{ item.hint }}</p>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.checks {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  list-style: none;
}
.check {
  display: flex;
  gap: var(--space-3);
}
.title {
  font-weight: 600;
}
.hint {
  font-size: var(--text-sm);
}
.ok {
  color: var(--ok);
}
.bad {
  color: var(--warn);
}
</style>
