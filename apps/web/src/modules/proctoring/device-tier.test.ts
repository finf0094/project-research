import { describe, expect, it } from 'vitest'
import { UNMEASURED, createTierWatch, lowerTier, tierFromTiming } from './device-tier'

describe('createTierWatch', () => {
  it('ignores the slow warm-up frames and a single slow frame', () => {
    const tooSlow = createTierWatch()
    const results = [900, 900, 900, 900, 900, 50, 50, 900, 50, 50, 50, 50].map(tooSlow)
    expect(results.every((r) => !r)).toBe(true)
  })

  it('drops the tier once analysis stays slow', () => {
    const tooSlow = createTierWatch()
    const results = Array.from({ length: 10 }, () => tooSlow(400))
    expect(results.indexOf(true)).toBe(9) // 5 warm-up frames, then 5 slow ones in a row
  })
})

describe('device tiers', () => {
  it('maps measured analysis time to a tier and lowers one step at a time', () => {
    expect(tierFromTiming(20)).toBe('full')
    expect(tierFromTiming(120)).toBe('lite')
    expect(tierFromTiming(500)).toBe('slow')
    expect(lowerTier('full')).toBe('lite')
    expect(lowerTier('lite')).toBe('slow')
    expect(lowerTier('slow')).toBe('slow') // the face check is never given up
  })

  it('keeps the face check on the weakest devices', () => {
    expect(UNMEASURED.slow).not.toContain('face_missing')
    expect(UNMEASURED.slow).not.toContain('multiple_faces')
    expect(UNMEASURED.none).toContain('face_missing')
  })
})
