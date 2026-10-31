import type { Listen } from '../../db/client.ts'

type Listener = (attemptId: string) => void

/**
 * Fans out the database's `attempt_updates` notifications (sent by a trigger, whichever process changed
 * the attempt) to the examiners watching that exam. One LISTEN per API process, started on first use.
 */
export function createLiveUpdates(listen: Listen) {
  const byExam = new Map<string, Set<Listener>>()
  let started: Promise<unknown> | null = null

  function deliver(payload: string) {
    const [examId, attemptId] = payload.split(':')
    if (examId && attemptId) byExam.get(examId)?.forEach((listener) => listener(attemptId))
  }

  return {
    async subscribe(examId: string, listener: Listener): Promise<() => void> {
      started ??= listen('attempt_updates', deliver).catch((error: unknown) => {
        started = null
        throw error
      })
      await started
      const listeners = byExam.get(examId) ?? new Set()
      listeners.add(listener)
      byExam.set(examId, listeners)
      return () => {
        listeners.delete(listener)
        if (!listeners.size) byExam.delete(examId)
      }
    },
  }
}
