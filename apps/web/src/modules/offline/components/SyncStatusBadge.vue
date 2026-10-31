<script setup lang="ts">
import { computed } from 'vue'
import { StatusPill } from '@/shared/ui'
import { useSyncStore } from '../sync.store'

const sync = useSyncStore()

const view = computed(() => {
  const { connection, pendingEvents } = sync.status
  if (connection === 'offline') return { tone: 'off', text: 'offline.badge.offline' } as const
  if (pendingEvents > 0) return { tone: 'warn', text: 'offline.badge.sending' } as const
  return { tone: 'ok', text: 'offline.badge.saved' } as const
})
</script>

<template>
  <StatusPill :tone="view.tone" dot role="status" aria-live="polite">{{ $t(view.text) }}</StatusPill>
</template>
