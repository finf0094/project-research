import { ref, type Ref } from 'vue'
import { errorKey, type ErrorKey } from './error-key'

/**
 * Runs a page action (load, save, send) and keeps its failure as a message key, so the page shows what
 * went wrong instead of going stale or blank. `overrides` give statuses an action-specific meaning.
 */
export function useAction<K extends string = never>(overrides?: Partial<Record<number, K>>) {
  const error = ref(null) as Ref<ErrorKey | K | null>
  const busy = ref(false)

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    error.value = null
    busy.value = true
    try {
      await action()
      return true
    } catch (e) {
      error.value = overrides ? errorKey(e, overrides) : errorKey(e)
      return false
    } finally {
      busy.value = false
    }
  }

  return { error, busy, run }
}
