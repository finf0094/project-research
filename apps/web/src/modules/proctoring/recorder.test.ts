import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextChunkMs, startRecorder, type RecordedChunk } from './recorder'

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

  it('keeps trying when the browser refuses to start a chunk (iOS in the background)', async () => {
    let refuse = 1
    vi.stubGlobal(
      'MediaRecorder',
      class extends FakeRecorder {
        override start() {
          if (refuse-- > 0) throw new DOMException('', 'InvalidStateError')
          super.start()
        }
      },
    )
    const chunks: RecordedChunk[] = []
    const recorder = startRecorder(
      {} as MediaStream,
      () => 0,
      (c) => chunks.push(c),
    )
    await vi.advanceTimersByTimeAsync(20_010)
    expect(chunks).toHaveLength(1)
    const stopped = recorder.stop()
    await vi.advanceTimersByTimeAsync(10)
    await stopped
  })

  it('waits for data that arrives after the stop event (Safari), and keeps no empty chunk', async () => {
    let calls = 0
    vi.stubGlobal(
      'MediaRecorder',
      class extends FakeRecorder {
        override stop() {
          this.state = 'inactive'
          const n = calls++
          setTimeout(() => {
            this.onstop?.()
            // The first chunk's data comes late; the second recorder delivers nothing at all.
            if (n === 0) setTimeout(() => this.ondataavailable?.({ data: new Blob(['frame']) }), 50)
            if (n === 1) this.ondataavailable?.({ data: new Blob([]) })
          }, 5)
        }
      },
    )
    const chunks: RecordedChunk[] = []
    const recorder = startRecorder(
      {} as MediaStream,
      () => 0,
      (c) => chunks.push(c),
    )
    await vi.advanceTimersByTimeAsync(10_060)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]!.blob.size).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(12_000)
    expect(chunks).toHaveLength(1) // the empty one is not handed over
    const stopped = recorder.stop()
    await vi.advanceTimersByTimeAsync(1100)
    await stopped
  })

  it('records shorter chunks when the browser ignores the bitrate, so none exceeds the upload limit', () => {
    const MB = 1024 * 1024
    expect(nextChunkMs(10_000, 100_000)).toBe(10_000)
    expect(nextChunkMs(10_000, 6 * MB)).toBe(5000)
    expect(nextChunkMs(5000, 3 * MB)).toBe(5000) // stays where it fits, no swing back to oversized chunks
    expect(nextChunkMs(10_000, 100 * MB)).toBe(2000)
    expect(nextChunkMs(2000, 200_000)).toBe(10_000)
    expect(nextChunkMs(10_000, 0)).toBe(10_000)
  })
})
