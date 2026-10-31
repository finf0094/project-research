<script setup lang="ts">
import { computed } from 'vue'
import { StatusPill } from '@/shared/ui'
import { useSyncStore } from '../sync.store'

const sync = useSyncStore()

// Calm wording on purpose: losing the network is not the student's fault and nothing is lost.
const view = computed(() => {
  const { connection, pendingEvents } = sync.status
  if (connection === 'offline')
    return { tone: 'off', text: 'Нет сети — ответы сохраняются на устройстве' } as const
  if (pendingEvents > 0) return { tone: 'warn', text: 'Сохранено на устройстве, отправляем…' } as const
  return { tone: 'ok', text: 'Всё сохранено' } as const
})
</script>

<template>
  <StatusPill :tone="view.tone" dot role="status" aria-live="polite">{{ view.text }}</StatusPill>
</template>
