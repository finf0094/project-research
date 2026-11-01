import { describe, expect, it } from 'vitest'
import type { FrameReport } from './detectors'
import { createSignalTracker, observeFrame, riskLevel, watchBrowser, type ObservedKind } from './signals'

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

describe('observeFrame', () => {
  const frame = (over: Partial<FrameReport>): FrameReport => ({
    faces: 1,
    lookingAway: false,
    inOval: true,
    pose: null,
    object: null,
    brightness: 120,
    ms: 10,
    ...over,
  })
  const seen = (f: FrameReport, tier: 'full' | 'slow' = 'full') => {
    const present = new Map<ObservedKind, boolean>()
    observeFrame(f, tier, (kind, on) => present.set(kind, on))
    return present
  }

  it('turns each case of the student into its observation', () => {
    expect(seen(frame({})).get('face_missing')).toBe(false)
    expect(seen(frame({ faces: 0, inOval: null })).get('face_missing')).toBe(true)
    expect(seen(frame({ faces: 2, inOval: null })).get('multiple_faces')).toBe(true)
    expect(seen(frame({ inOval: false })).get('off_center')).toBe(true)
    expect(seen(frame({ lookingAway: true })).get('looking_away')).toBe(true)
    expect(seen(frame({ object: true })).get('object_detected')).toBe(true)
  })

  it('does not blame the student for a dark room or a weak device', () => {
    expect(seen(frame({ faces: 0, brightness: 30 })).get('face_missing')).toBe(false) // a dim room
  })

  it('takes a black picture for a covered camera, not a dark room', () => {
    const covered = seen(frame({ faces: 0, brightness: 5 }))
    expect(covered.get('face_missing')).toBe(true)
    expect(covered.get('too_dark')).toBe(false)
  })

  it('measures no gaze on a weak device', () => {
    expect(seen(frame({ lookingAway: true }), 'slow').get('looking_away')).toBe(false)
  })
})

describe('watchBrowser', () => {
  it('reports copied exam text', () => {
    const changes: string[] = []
    const stop = watchBrowser((kind, on) => changes.push(`${kind}:${on}`))
    const selection = document.getSelection
    document.getSelection = () =>
      ({ toString: () => 'Какое свойство ACID гарантирует атомарность?' }) as never
    document.dispatchEvent(new Event('copy'))
    expect(changes).toEqual(['copy:true', 'copy:false'])
    document.getSelection = selection
    stop()
  })
})
