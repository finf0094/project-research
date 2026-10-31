import { onScopeDispose, ref } from 'vue'

/** Whether the browser has a network (it knows nothing of the server: use it for hints, not decisions). */
export function useOnline() {
  const online = ref(navigator.onLine)
  const update = () => (online.value = navigator.onLine)
  addEventListener('online', update)
  addEventListener('offline', update)
  onScopeDispose(() => {
    removeEventListener('online', update)
    removeEventListener('offline', update)
  })
  return online
}
