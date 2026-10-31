import { ref, watch, type Ref } from 'vue'

/**
 * A small per-device preference kept in localStorage. Storage may be unavailable (private mode, blocked
 * site data): then the value simply lives for this page.
 */
export function useStored<T>(key: string, fallback: T): Ref<T> {
  const value = ref(read(key, fallback)) as Ref<T>
  watch(
    value,
    (next) => {
      try {
        localStorage.setItem(key, JSON.stringify(next))
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
