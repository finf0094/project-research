import { describe, expect, it } from 'vitest'
import { toIntervals, type Observation } from './observations.ts'

const seconds = (n: number, o: Partial<Observation>) =>
  Array.from({ length: n }, (_, i) => ({
    at: i * 1000,
    faces: 1,
    object: false,
    dark: false,
    loud: false,
    ...o,
  }))

describe('toIntervals', () => {
  it('needs a condition to last before it becomes a finding', () => {
    expect(toIntervals(seconds(1, { faces: 2 }))).toEqual([])
    expect(toIntervals(seconds(3, { faces: 2 }))).toEqual([
      { kind: 'multiple_faces', startAt: 0, endAt: 3000 },
    ])
  })

  it('is stricter for an empty frame than for a phone', () => {
    expect(toIntervals(seconds(4, { faces: 0 }))).toEqual([])
    expect(toIntervals(seconds(5, { faces: 0 }))).toEqual([{ kind: 'face_missing', startAt: 0, endAt: 5000 }])
    expect(toIntervals(seconds(2, { object: true }))).toEqual([
      { kind: 'object_detected', startAt: 0, endAt: 2000 },
    ])
  })

  it('ends an interval at a gap between fragments', () => {
    const observations = [
      ...seconds(3, { faces: 2 }),
      ...seconds(3, { faces: 2 }).map((o) => ({ ...o, at: o.at + 60_000 })),
    ]
    expect(toIntervals(observations)).toHaveLength(2)
  })

  it('does not count a missing face in a dark frame', () => {
    expect(toIntervals(seconds(8, { faces: 0, dark: true }))).toEqual([])
  })

  it('turns noise that lasts 3 s into a finding, but not a short sound', () => {
    expect(toIntervals(seconds(2, { loud: true }))).toEqual([])
    expect(toIntervals(seconds(3, { loud: true }))).toEqual([{ kind: 'noise', startAt: 0, endAt: 3000 }])
  })
})
