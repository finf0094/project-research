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

/** From this risk score up an attempt is "worth a look now": announced once, shown stronger. */
export const HIGH_RISK = 60
/** Below this the risk is low; between the two it is worth a glance. */
export const MID_RISK = 30
export type RiskLevel = 'none' | 'low' | 'mid' | 'high'
export const riskLevel = (risk: number | null): RiskLevel =>
  risk === null ? 'none' : risk >= HIGH_RISK ? 'high' : risk >= MID_RISK ? 'mid' : 'low'

export const CONNECTION_TONE: Record<NetState, Tone> = { online: 'ok', slow: 'warn', offline: 'off' }
