import type { SignalKind } from '@exam/contracts'
import type { EventLog } from '@/modules/offline'
import { HINTED } from './signals'

const HINT_REPEAT_MS = 60_000
/** The "stay on the tab" hint is only visible after the student comes back, so it lingers a little. */
const RETURN_HINT_MS = 10_000

/**
 * Decides which hint the student sees: the first active signal that has one, or the lingering tab hint.
 * A shown hint is logged once a minute per kind (only while the page is visible, i.e. actually seen).
 */
export function createHinter(log: EventLog, now: () => number, onHint: (kind: SignalKind | null) => void) {
  const lastLogged = new Map<SignalKind, number>()
  let returnHintUntil = 0

  return {
    /** Called when the student comes back to the tab. */
    returned() {
      returnHintUntil = now() + RETURN_HINT_MS
    },
    show(active: ReadonlySet<SignalKind>) {
      // The most pressing hint first (HINTED's order), whatever turned on first.
      const kind = [...HINTED].find((k) => active.has(k)) ?? (now() < returnHintUntil ? 'tab_hidden' : null)
      onHint(kind)
      if (!kind || document.visibilityState !== 'visible') return
      if (now() - (lastLogged.get(kind) ?? -Infinity) <= HINT_REPEAT_MS) return
      lastLogged.set(kind, now())
      void log.append('hint.shown', { kind })
    },
  }
}
