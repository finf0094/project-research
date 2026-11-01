import type { AttemptSummary } from '@exam/contracts'
import { HIGH_RISK } from './labels'

export type AlertKind = 'submitted' | 'offline' | 'online' | 'risk' | 'ready' | 'more'

export interface Alert {
  id: string
  kind: AlertKind
  name: string
  attemptId: string
  at: number
  /** `more`: how many changes were folded into this line by the attention budget. */
  count?: number
}

const FINISHED = new Set(['submitted', 'ready_for_review', 'decided'])

/**
 * What changed between two snapshots of an exam's attempts that a proctor should hear about: a student
 * finished, lost or regained the connection, crossed into high risk, or their recording was analysed.
 * Everything else (an answer saved, a risk tick) stays quiet: one proctor, many students.
 */
export function alertsBetween(before: AttemptSummary[], after: AttemptSummary[], at: number): Alert[] {
  const previous = new Map(before.map((a) => [a.id, a]))
  const alerts: Alert[] = []
  for (const now of after) {
    const was = previous.get(now.id)
    if (!was) continue // a new attempt is not news; it shows in the list
    const push = (kind: AlertKind) =>
      alerts.push({ id: `${now.id}:${kind}:${at}`, kind, name: now.student.name, attemptId: now.id, at })
    if (!FINISHED.has(was.status) && FINISHED.has(now.status)) push('submitted')
    if (was.connection !== 'offline' && now.connection === 'offline') push('offline')
    if (was.connection === 'offline' && now.connection === 'online') push('online')
    if ((was.riskScore ?? 0) < HIGH_RISK && (now.riskScore ?? 0) >= HIGH_RISK) push('risk')
    if (was.status === 'submitted' && now.status === 'ready_for_review') push('ready')
  }
  return alerts
}
