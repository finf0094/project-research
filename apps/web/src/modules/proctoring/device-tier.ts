import type { DeviceTier } from '@exam/contracts'
import type { ObservedKind } from './signals'

const KEY = 'exam.deviceTier'

/**
 * Chosen from the measured analysis time at preflight. It is a property of this computer, so it is
 * kept in localStorage; an unknown computer starts in the middle tier.
 */
export function tierFromTiming(msPerFrame: number): DeviceTier {
  if (msPerFrame < 60) return 'full'
  if (msPerFrame < 200) return 'lite'
  return 'slow'
}

export function savedTier(): DeviceTier {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'full' || value === 'lite' || value === 'slow' ? value : 'lite'
  } catch {
    return 'lite'
  }
}

export function saveTier(tier: DeviceTier) {
  try {
    localStorage.setItem(KEY, tier)
  } catch {
    /* the default tier is used next time */
  }
}

/** Signals each tier no longer measures; they are switched off when the tier drops, never left stuck on. */
export const UNMEASURED: Record<DeviceTier, ObservedKind[]> = {
  full: [],
  lite: [],
  // Weak devices keep the face check, at a slower pace; gaze and objects cost too much.
  slow: ['object_detected', 'looking_away'],
  none: ['object_detected', 'face_missing', 'multiple_faces', 'looking_away', 'off_center'],
  minimal: ['object_detected', 'face_missing', 'multiple_faces', 'looking_away', 'off_center'], // only older clients
}

/** One step down when analysis gets too slow during the exam: the exam itself must stay smooth. */
export function lowerTier(tier: DeviceTier): DeviceTier {
  return tier === 'full' ? 'lite' : tier === 'lite' ? 'slow' : tier
}

/** Average analysis time above which the tier is lowered one step. */
const SLOW_ANALYSIS_MS = 250
/** The first frames warm the models up and are slow by nature; they never count. */
const WARMUP_FRAMES = 5
/** The average must stay slow this many frames in a row before the tier drops. */
const SLOW_FRAMES = 5

/**
 * Watches how long each analysed frame takes and says when to drop a tier: only after warm-up, and only
 * when the smoothed average stays slow for several frames (one slow frame is never enough).
 */
export function createTierWatch() {
  let average = 0
  let frames = 0
  let slow = 0
  /** Records one frame's time; true when the tier should be lowered now. */
  return function shouldLower(ms: number): boolean {
    if (++frames <= WARMUP_FRAMES) return false
    average = average ? average * 0.8 + ms * 0.2 : ms
    slow = average > SLOW_ANALYSIS_MS ? slow + 1 : 0
    if (slow < SLOW_FRAMES) return false
    // The lower tier is measured afresh: the old tier's slow average would otherwise drop it again at once.
    average = frames = slow = 0
    return true
  }
}
