import { describe, expect, it } from 'vitest'
import { createSignalTracker, riskLevel } from './signals'

describe('signal tracker', () => {
  it('ignores a short glance away and fires after the condition persists', () => {
    const t = createSignalTracker()
    expect(t.observe('face_missing', true, 0)).toBeNull()
    expect(t.observe('face_missing', false, 2000)).toBeNull() // came back within 5 s
    expect(t.observe('face_missing', true, 3000)).toBeNull()
    expect(t.observe('face_missing', true, 8000)).toEqual({ kind: 'face_missing', active: true })
  })

  it('turns off only after the condition is gone for a while', () => {
    const t = createSignalTracker()
    t.observe('multiple_faces', true, 0)
    t.observe('multiple_faces', true, 2000)
    expect(t.observe('multiple_faces', false, 2500)).toBeNull()
    expect(t.observe('multiple_faces', false, 4600)).toEqual({ kind: 'multiple_faces', active: false })
  })
})

describe('riskLevel', () => {
  it('is low for environment-only signals such as darkness', () => {
    expect(riskLevel(new Set(['too_dark']), 0)).toBe('low')
  })
  it('is medium for one behavioural signal and high for two or another person', () => {
    expect(riskLevel(new Set(['tab_hidden']), 0)).toBe('medium')
    expect(riskLevel(new Set(['tab_hidden', 'noise']), 0)).toBe('high')
    expect(riskLevel(new Set(['multiple_faces']), 0)).toBe('high')
  })
  it('is medium when signals keep repeating', () => {
    expect(riskLevel(new Set(), 3)).toBe('medium')
  })
})
