import { describe, expect, it } from 'vitest'
import { shouldDismiss } from './sheet-drag'

describe('dragging a bottom sheet', () => {
  it('closes past a quarter of its height or on a quick flick, and springs back otherwise', () => {
    expect(shouldDismiss(120, 400, 0.2)).toBe(true)
    expect(shouldDismiss(40, 400, 1)).toBe(true)
    expect(shouldDismiss(40, 400, 0.2)).toBe(false)
  })
})
