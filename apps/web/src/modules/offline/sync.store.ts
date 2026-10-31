import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SyncStatus } from './sync-loop'

/** What the student sees about saving: connection, what is still on the device, last sync. */
export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatus>({
    connection: 'online',
    pendingEvents: 0,
    pendingChunks: 0,
    lastSyncedAt: null,
  })
  const set = (next: SyncStatus) => (status.value = next)
  return { status, set }
})
