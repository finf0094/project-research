import { computed, type Ref, type WritableComputedRef } from 'vue'

/**
 * `v-model` for one field of an object model, without mutating it: writing the field replaces the whole
 * object, so the parent always receives a new value (`const title = field('title')`).
 */
export function useFields<T extends object>(model: Ref<T>) {
  return <K extends keyof T>(key: K): WritableComputedRef<T[K]> =>
    computed({
      get: () => model.value[key],
      set: (value) => (model.value = { ...model.value, [key]: value }),
    })
}

/** <input type="datetime-local"> works in local time without seconds: "2026-11-02T09:30". */
export function toLocalInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

export const fromLocalInput = (value: string): number => new Date(value).getTime()
