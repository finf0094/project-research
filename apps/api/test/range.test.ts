import { describe, expect, it } from 'vitest'
import { byteRange } from '../src/shared/range.ts'

describe('byteRange', () => {
  it('reads the ranges media players ask for', () => {
    expect(byteRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 })
    expect(byteRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 })
    expect(byteRange('bytes=90-500', 100)).toEqual({ start: 90, end: 99 })
    expect(byteRange('bytes=-30', 100)).toEqual({ start: 70, end: 99 })
  })

  it('sends everything without a usable header, and refuses ranges outside the data', () => {
    expect(byteRange(undefined, 100)).toBeNull()
    expect(byteRange('bytes=1-2,5-6', 100)).toBeNull()
    expect(byteRange('bytes=100-', 100)).toBe('unsatisfiable')
    expect(byteRange('bytes=20-10', 100)).toBe('unsatisfiable')
  })
})
