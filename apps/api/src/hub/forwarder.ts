import { SyncResponse } from '@exam/contracts'
import type { HubStore } from './store.ts'

export interface Upstream {
  /** The cloud's base URL, e.g. https://exam.university.kz */
  url(): string
  token: string
}

/**
 * Delivers one attempt's collected events to the cloud, oldest first, and keeps only what the cloud did not
 * take. True when this attempt needs no further batch now (all delivered, nothing taken, or a broken chain,
 * which goes to review and accepts nothing more).
 */
export async function forwardAttempt(
  store: HubStore,
  upstream: Upstream,
  attemptId: string,
): Promise<boolean> {
  let done = true
  await store.update(attemptId, async (state) => {
    if (!state?.pending.length) return null
    const response = await fetch(`${upstream.url()}/api/hub/attempts/${attemptId}/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${upstream.token}` },
      body: JSON.stringify({ events: state.pending.slice(0, 100) }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`cloud refused the relay: ${response.status}`)
    const last = SyncResponse.parse(await response.json())
    const pending = last.chainBroken ? [] : state.pending.filter((p) => p.event.seq > last.ackedSeq)
    // Nothing taken (the cloud still waits for earlier events from the device): stop for this pass.
    done = pending.length === 0 || pending.length === state.pending.length
    return { ...state, last, pending }
  })
  return done
}

/** One pass over every attempt with collected events; unreachable cloud means: try again next pass. */
export async function forwardAll(store: HubStore, upstream: Upstream) {
  for (const id of await store.list()) {
    try {
      while (!(await forwardAttempt(store, upstream, id))) {
        /* more than one batch */
      }
    } catch {
      return // the cloud is still away
    }
  }
}
