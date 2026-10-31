import type { CallEvent } from '@exam/contracts'

/** A leave this close to the end is hanging up, not a drop. */
const FINAL_DROP_GRACE_MS = 30_000

export interface CallSpan {
  kind: 'on' | 'off'
  from: number
  to: number
}

/**
 * The student's time on the call as alternating spans: on the call, and off it (a drop) until they joined
 * again. A span still open at the end runs to `end` (submission); a leave that is not followed by a join
 * well before the end is a final drop. The examiner's own joins do not count.
 */
export function studentSpans(events: CallEvent[], end: number): CallSpan[] {
  const spans: CallSpan[] = []
  let since: number | null = null
  let lastLeft: number | null = null
  for (const e of events.filter((e) => e.who === 'student')) {
    if (e.kind === 'joined' && since === null) {
      if (lastLeft !== null) spans.push({ kind: 'off', from: lastLeft, to: e.at })
      since = e.at
    } else if (e.kind === 'left' && since !== null) {
      spans.push({ kind: 'on', from: since, to: e.at })
      since = null
      lastLeft = e.at
    }
  }
  if (since !== null) spans.push({ kind: 'on', from: since, to: Math.max(since, end) })
  // Leaving right at the end is just hanging up after submitting.
  else if (lastLeft !== null && end - lastLeft > FINAL_DROP_GRACE_MS)
    spans.push({ kind: 'off', from: lastLeft, to: end })
  return spans
}
