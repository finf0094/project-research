import type { RiskLevel, SignalKind } from '@exam/contracts'

/** Signals measured continuously from camera and microphone; the rest are browser events. */
export type ObservedKind = 'face_missing' | 'multiple_faces' | 'too_dark' | 'noise'

interface Rule {
  /** The condition must hold this long before the signal turns on (a glance away is not a signal). */
  onAfterMs: number
  /** ...and be gone this long before it turns off, so flicker does not produce a burst of events. */
  offAfterMs: number
}

const RULES: Record<ObservedKind, Rule> = {
  face_missing: { onAfterMs: 5000, offAfterMs: 2000 },
  multiple_faces: { onAfterMs: 2000, offAfterMs: 2000 },
  too_dark: { onAfterMs: 5000, offAfterMs: 3000 },
  noise: { onAfterMs: 3000, offAfterMs: 3000 },
}

export interface Transition {
  kind: ObservedKind
  active: boolean
}

/** Turns noisy per-frame observations into stable on/off signals. */
export function createSignalTracker() {
  const state = new Map<ObservedKind, { active: boolean; changingSince: number | null }>()

  return {
    observe(kind: ObservedKind, present: boolean, now: number): Transition | null {
      const s = state.get(kind) ?? { active: false, changingSince: null }
      state.set(kind, s)
      if (present === s.active) {
        s.changingSince = null
        return null
      }
      s.changingSince ??= now
      const wait = present ? RULES[kind].onAfterMs : RULES[kind].offAfterMs
      if (now - s.changingSince < wait) return null
      s.active = present
      s.changingSince = null
      return { kind, active: present }
    },
  }
}

/** Mean frame brightness (0..255) below which the room counts as too dark. */
export const DARK_BRIGHTNESS = 45
/** Microphone RMS above which the room counts as noisy. */
export const NOISE_RMS = 0.08

/**
 * Problems of the environment or the device; they never raise the risk (and with the camera off
 * there is nothing to record anyway). The examiner still sees them on the timeline.
 */
const ENVIRONMENT: ReadonlySet<SignalKind> = new Set(['too_dark', 'camera_off'])

/**
 * How much evidence to collect right now (review section 10.1). Risk never depends on the network.
 * high: another person in view, or two behavioural signals at once; medium: one behavioural signal,
 * or several activations in the recent window.
 */
export function riskLevel(active: ReadonlySet<SignalKind>, recentActivations: number): RiskLevel {
  const behavioural = [...active].filter((k) => !ENVIRONMENT.has(k))
  if (active.has('multiple_faces') || behavioural.length >= 2) return 'high'
  if (behavioural.length === 1 || recentActivations >= 3) return 'medium'
  return 'low'
}

/** Frames analysed per second at each level. */
export const ANALYSIS_FPS: Record<RiskLevel, number> = { low: 1, medium: 2, high: 4 }

/** What the student sees: what to fix, never an accusation. */
export const HINTS: Partial<Record<SignalKind, string>> = {
  face_missing: 'Мы не видим ваше лицо. Сядьте перед камерой.',
  multiple_faces: 'В кадре несколько человек. Во время экзамена вы должны быть один.',
  too_dark: 'Слишком темно. Включите свет или повернитесь к окну.',
  noise: 'Вокруг шумно. Постарайтесь найти тихое место.',
  tab_hidden: 'Пожалуйста, оставайтесь на вкладке экзамена.',
  camera_off: 'Камера выключена. Включите её, чтобы продолжить под наблюдением.',
}
