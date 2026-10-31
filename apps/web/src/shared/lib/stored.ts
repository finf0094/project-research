import { ref, watch, type Ref } from 'vue'

/**
 * A small per-device preference kept in localStorage; back at its default it is removed, not stored.
 * Storage may be unavailable (private mode, blocked site data): then the value simply lives for this page.
 */
export function useStored<T>(key: string, fallback: T): Ref<T> {
  const value = ref(read(key, fallback)) as Ref<T>
  watch(
    value,
    (next) => {
      try {
        const raw = JSON.stringify(next)
        if (raw === JSON.stringify(fallback)) localStorage.removeItem(key)
        else localStorage.setItem(key, raw)
      } catch {
        // Not remembered, still works.
      }
    },
    { deep: true },
  )
  return value
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
