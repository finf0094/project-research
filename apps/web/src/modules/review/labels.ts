import type { AttemptStatus, NetState } from '@exam/contracts'

type Tone = 'ok' | 'warn' | 'off' | 'accent' | 'danger'

/** Colours of the status pills; their texts live in messages.ts. */
export const STATUS_TONE: Record<AttemptStatus, Tone> = {
  active: 'accent',
  terminated: 'warn',
  submitted: 'accent',
  ready_for_review: 'warn',
  decided: 'ok',
}

export const CONNECTION_TONE: Record<NetState, Tone> = { online: 'ok', slow: 'warn', offline: 'off' }
