import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startRecorder, type RecordedChunk } from './recorder'

/** A MediaRecorder whose stop() completes asynchronously, like the real one. */
class FakeRecorder {
  static isTypeSupported = () => true
  state: 'inactive' | 'recording' = 'inactive'
  mimeType = 'video/webm'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  start() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    setTimeout(() => {
      this.ondataavailable?.({ data: new Blob(['frame']) })
      this.onstop?.()
    }, 5)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('MediaRecorder', FakeRecorder)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('recorder', () => {
  it('produces a standalone chunk every 10 seconds', async () => {
    let t = 0
    const chunks: RecordedChunk[] = []
    const recorder = startRecorder(
      {} as MediaStream,
      () => t,
      (c) => chunks.push(c),
    )
    for (let i = 0; i < 25; i++) {
      t += 10_000
      await vi.advanceTimersByTimeAsync(10_005)
    }
    expect(chunks).toHaveLength(25)
    const stopped = recorder.stop()
    await vi.advanceTimersByTimeAsync(10)
    await stopped
  })

  it('stop() waits for a chunk whose recorder is already stopping', async () => {
    const chunks: RecordedChunk[] = []
    const recorder = startRecorder(
      {} as MediaStream,
      () => 0,
      (c) => chunks.push(c),
    )
    await vi.advanceTimersByTimeAsync(10_000) // the cycle timer has called stop(); onstop is still pending
    const stopped = recorder.stop()
    await vi.advanceTimersByTimeAsync(10)
    await stopped
    expect(chunks).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(chunks).toHaveLength(1) // no new cycle after stop
  })
})
