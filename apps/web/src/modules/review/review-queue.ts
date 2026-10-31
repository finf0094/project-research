import type { AttemptSummary } from '@exam/contracts'

export interface QueuePlace {
  /** 1-based place of this attempt in the queue, or null when it is not waiting (already decided). */
  position: number | null
  total: number
  /** Who to review after this one: the next waiting attempt, riskiest first. */
  next: { id: string; name: string } | null
}

/** Where an attempt stands in its exam's review queue (attempts arrive ordered riskiest first). */
export function queuePlace(attempts: AttemptSummary[], attemptId: string): QueuePlace {
  const waiting = attempts.filter((a) => a.status === 'ready_for_review')
  const index = waiting.findIndex((a) => a.id === attemptId)
  // After the last one, back to the riskiest still waiting.
  const next = (index >= 0 ? waiting[index + 1] : undefined) ?? waiting.find((a) => a.id !== attemptId)
  return {
    position: index >= 0 ? index + 1 : null,
    total: waiting.length,
    next: next ? { id: next.id, name: next.student.name } : null,
  }
}
