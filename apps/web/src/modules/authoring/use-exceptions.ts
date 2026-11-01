import type { SignalException, SignalKind } from '@exam/contracts'
import { ref, watch, type Ref } from 'vue'
import { errorKey, type ErrorKey } from '@/shared/lib/error-key'
import { setException } from './api'

/**
 * Section 25.3, saving individual exceptions. Kept with the page (not in the card), so a save that ends
 * while the examiner is on another step still lands or rolls back; an answer about an exam the page has
 * left is dropped.
 */
export function useExceptions(examId: Ref<string | null>, exceptions: Ref<SignalException[]>) {
  const saving = ref(new Set<string>())
  /** A refused save, per student: another student's save must not hide it. */
  const failed = ref(new Map<string, ErrorKey>())

  const disabledFor = (email: string) =>
    exceptions.value.find((e) => e.email === email)?.disabledSignals ?? []
  const put = (email: string, disabledSignals: SignalKind[]) =>
    (exceptions.value = [...exceptions.value.filter((e) => e.email !== email), { email, disabledSignals }])
  const without = <T>(set: Set<T>, item: T) => new Set([...set].filter((x) => x !== item))

  /** Shown at once and saved; a refused save puts the student's previous list back. */
  async function toggle(email: string, signal: SignalKind, on: boolean) {
    const id = examId.value
    if (!id) return
    const before = disabledFor(email)
    const next = on ? [...before, signal] : before.filter((s) => s !== signal)
    put(email, next)
    saving.value = new Set(saving.value).add(email)
    let refused: ErrorKey | null = null
    try {
      await setException(id, { email, disabledSignals: next })
    } catch (error) {
      refused = errorKey(error)
    }
    if (examId.value !== id) return
    if (refused) put(email, before)
    const errors = new Map(failed.value)
    if (refused) errors.set(email, refused)
    else errors.delete(email)
    failed.value = errors
    saving.value = without(saving.value, email)
  }

  /** The server drops a removed student's exception (a returning student starts without one). */
  function keepOnly(participants: string[]) {
    exceptions.value = exceptions.value.filter((e) => participants.includes(e.email))
    failed.value = new Map([...failed.value].filter(([email]) => participants.includes(email)))
  }

  watch(examId, () => {
    saving.value = new Set()
    failed.value = new Map()
  })

  return { saving, failed, disabledFor, toggle, keepOnly }
}
