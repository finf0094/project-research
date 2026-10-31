import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SyncStatus } from './sync-loop'

const INITIAL: SyncStatus = { connection: 'online', pendingEvents: 0, pendingChunks: 0 }

/** What the student sees about saving: connection and what is still only on the device. */
export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatus>({ ...INITIAL })
  const set = (next: SyncStatus) => (status.value = next)
  const reset = () => (status.value = { ...INITIAL })
  return { status, set, reset }
})
