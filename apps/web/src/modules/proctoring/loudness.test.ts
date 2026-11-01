import { afterEach, describe, expect, it, vi } from 'vitest'
import { saveNoiseFloor, savedNoiseFloor } from './calibration'
import { createLoudnessMeter } from './loudness'
import { noiseThreshold } from './signals'

/** An analyser whose next readings are given amplitudes (a constant signal of that RMS). */
function fakeAnalyser(levels: number[]) {
  return {
    fftSize: 8,
    getFloatTimeDomainData: (out: Float32Array) => out.fill(levels.shift() ?? 0),
  } as unknown as AnalyserNode
}

describe('microphone level', () => {
  afterEach(() => vi.useRealTimers())

  it('is the median of the last second: a whisper counts, single clicks do not', () => {
    vi.useFakeTimers()
    const clicks = Array.from({ length: 20 }, (_, i) => (i % 5 === 0 ? 0.3 : 0.002))
    const meter = createLoudnessMeter(fakeAnalyser([...clicks, ...Array<number>(20).fill(0.015)]))
    vi.advanceTimersByTime(1000)
    expect(meter.level()).toBeCloseTo(0.002)
    vi.advanceTimersByTime(1000)
    expect(meter.level()).toBeCloseTo(0.015)
    meter.stop()
  })
})

describe('noise threshold', () => {
  it('follows the room: a whisper is above a quiet room, a fan room needs more', () => {
    expect(0.015).toBeGreaterThan(noiseThreshold(0.002))
    expect(0.015).toBeLessThan(noiseThreshold(0.01))
    expect(noiseThreshold(0)).toBe(0.008)
    expect(noiseThreshold(1)).toBe(0.08)
    expect(noiseThreshold(null)).toBe(0.012)
  })

  it('keeps the quiet level of preflight, not the moments the student spoke', () => {
    localStorage.clear()
    saveNoiseFloor([0, 0, 0, 0])
    expect(savedNoiseFloor()).toBeNull()
    saveNoiseFloor([0.002, 0.2, 0.003, 0.002, 0.25, 0.002, 0.003, 0.2])
    expect(savedNoiseFloor()).toBe(0.002)
  })
})
