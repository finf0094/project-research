import type { DeviceTier } from '@exam/contracts'

const KEY = 'exam.deviceTier'

/**
 * Chosen from the measured analysis time at preflight. It is a property of this computer, so it is
 * kept in localStorage; an unknown computer starts in the middle tier.
 */
export function tierFromTiming(msPerFrame: number): DeviceTier {
  if (msPerFrame < 60) return 'full'
  if (msPerFrame < 200) return 'lite'
  return 'minimal'
}

export function savedTier(): DeviceTier {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'full' || value === 'lite' || value === 'minimal' ? value : 'lite'
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

/** One step down when analysis gets too slow during the exam: the exam itself must stay smooth. */
export function lowerTier(tier: DeviceTier): DeviceTier {
  return tier === 'full' ? 'lite' : 'minimal'
}
