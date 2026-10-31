import { computed } from 'vue'
import { useStored } from '@/shared/lib/stored'

export const TEXT_SIZES = ['s', 'm', 'l'] as const
export type TextSize = (typeof TEXT_SIZES)[number]
const SCALE: Record<TextSize, number> = { s: 0.9, m: 1, l: 1.2 }

/** The question's text size, remembered on this device for every exam. */
export function useTextSize() {
  const size = useStored<TextSize>('exam:text-size', 'm')
  const scale = computed(() => SCALE[size.value] ?? 1)
  return { size, scale }
}

/**
 * Questions the student marked to come back to; a private note of this device, never sent anywhere.
 * `forget()` once the exam is over, so a shared computer keeps nothing.
 */
export function useFlags(attemptId: string) {
  const flagged = useStored<string[]>(`exam:flags:${attemptId}`, [])
  const has = (questionId: string) => flagged.value.includes(questionId)
  const toggle = (questionId: string) =>
    (flagged.value = has(questionId)
      ? flagged.value.filter((id) => id !== questionId)
      : [...flagged.value, questionId])
  const forget = () => (flagged.value = [])
  return { flagged, has, toggle, forget }
}
