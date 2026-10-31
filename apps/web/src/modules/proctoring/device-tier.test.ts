import { describe, expect, it } from 'vitest'
import { createTierWatch } from './device-tier'

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
