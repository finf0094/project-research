import type { DeviceTier, RiskLevel, SignalKind } from '@exam/contracts'
import type { FrameReport } from './detectors'

/** Signals measured continuously from camera and microphone; the rest are browser events. */
export type ObservedKind =
  'face_missing' | 'multiple_faces' | 'too_dark' | 'noise' | 'looking_away' | 'object_detected' | 'off_center'

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
  // Reading the question and thinking means glancing around; only a sustained look away counts.
  looking_away: { onAfterMs: 8000, offAfterMs: 2000 },
  object_detected: { onAfterMs: 2000, offAfterMs: 4000 },
  // Shifting in the chair is normal; only staying out of the oval counts.
  off_center: { onAfterMs: 4000, offAfterMs: 2000 },
}

export interface Transition {
  kind: ObservedKind
  active: boolean
}

/** Turns noisy per-frame observations into stable on/off signals. */
export function createSignalTracker() {
  const state = new Map<ObservedKind, { active: boolean; changingSince: number | null }>()

  return {
    /** Forgets a signal that is no longer measured. */
    reset(kind: ObservedKind) {
      state.delete(kind)
    },
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
/** Below this the picture is black: the camera is covered, not the room dim, so a missing face counts. */
export const COVERED_BRIGHTNESS = 15
/** The page may lose focus this long (the browser's own menus, a permission prompt) before it counts. */
const BLUR_GRACE_MS = 2000
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

/** Object detection is the heaviest model: run it every few seconds only (the exam and preflight alike). */
export const OBJECTS_EVERY_MS = 2000
/** How often each tier looks for a phone or a book: middle devices too, only less often. */
export const objectsEvery = (tier: DeviceTier) =>
  tier === 'full' ? OBJECTS_EVERY_MS : tier === 'lite' ? 5 * OBJECTS_EVERY_MS : Infinity

/** Frames analysed per second at each level. */
export const ANALYSIS_FPS: Record<RiskLevel, number> = { low: 1, medium: 2, high: 4 }

/** Signals the student gets a hint for (what to fix, never an accusation; texts in messages.ts). */
export const HINTED: ReadonlySet<SignalKind> = new Set([
  'face_missing',
  'multiple_faces',
  'too_dark',
  'noise',
  'tab_hidden',
  'camera_off',
  'looking_away',
  'object_detected',
  'off_center',
  'second_screen',
  'mic_off',
])

/** Browser signals: leaving the tab and pasting. Returns a function that stops watching. */
export function watchBrowser(setSignal: (kind: SignalKind, on: boolean) => void) {
  // Away from the exam: its tab hidden, or another window or app in front while the tab stays visible.
  const away = () => setSignal('tab_hidden', document.visibilityState === 'hidden' || !document.hasFocus())
  // Clicking the browser's own controls blurs the page for a moment; only staying away counts.
  let blurred: ReturnType<typeof setTimeout> | undefined
  const onBlur = () => (clearTimeout(blurred), (blurred = setTimeout(away, BLUR_GRACE_MS)))
  const onFocus = () => (clearTimeout(blurred), away())
  // Only substantial text matters; moving a word around is normal editing.
  const substantial = (text: string | undefined) => (text ?? '').trim().length >= 20
  const pulse = (kind: SignalKind) => (setSignal(kind, true), setSignal(kind, false))
  const onPaste = (event: ClipboardEvent) =>
    substantial(event.clipboardData?.getData('text')) && pulse('paste')
  const onCopy = () => substantial(document.getSelection()?.toString()) && pulse('copy')
  // A second screen (Chromium tells; elsewhere this stays unknown and silent).
  const display = screen as unknown as EventTarget & { isExtended?: boolean }
  const onScreen = () => display.isExtended !== undefined && setSignal('second_screen', display.isExtended)
  onScreen()
  document.addEventListener('visibilitychange', away)
  window.addEventListener('blur', onBlur)
  window.addEventListener('focus', onFocus)
  document.addEventListener('paste', onPaste)
  document.addEventListener('copy', onCopy)
  display.addEventListener('change', onScreen)
  return () => {
    clearTimeout(blurred)
    document.removeEventListener('visibilitychange', away)
    window.removeEventListener('blur', onBlur)
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('paste', onPaste)
    document.removeEventListener('copy', onCopy)
    display.removeEventListener('change', onScreen)
  }
}

/** A muted or disconnected microphone (the system's mute, an unplugged headset) is a signal of its own. */
export function watchMicrophone(stream: MediaStream, setSignal: (kind: SignalKind, on: boolean) => void) {
  const tracks = stream.getAudioTracks()
  const update = () =>
    setSignal(
      'mic_off',
      tracks.some((t) => t.muted || t.readyState === 'ended'),
    )
  for (const track of tracks)
    for (const type of ['mute', 'unmute', 'ended']) track.addEventListener(type, update)
  return () => {
    for (const track of tracks)
      for (const type of ['mute', 'unmute', 'ended']) track.removeEventListener(type, update)
  }
}

/** One analysed frame as observations, by what the device's tier measures. */
export function observeFrame(
  frame: FrameReport,
  tier: DeviceTier,
  observe: (kind: ObservedKind, present: boolean) => void,
) {
  // A black picture is a covered camera, not a dim room: then a missing face is the student's doing.
  const dark = frame.brightness < DARK_BRIGHTNESS && frame.brightness >= COVERED_BRIGHTNESS
  observe('too_dark', dark)
  if (frame.faces != null) {
    // In the dark the detector misses faces; that is the room's fault, not the student's behaviour.
    observe('face_missing', frame.faces === 0 && !dark)
    observe('multiple_faces', frame.faces >= 2)
    // Position and gaze are measured on a single face; with none or several they cannot be off.
    observe('off_center', frame.inOval === false)
    observe('looking_away', tier !== 'slow' && frame.lookingAway === true)
  }
  if (frame.object != null) observe('object_detected', frame.object)
}
