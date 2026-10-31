import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useLiveUpdates } from './live-updates'

class FakeSource extends EventTarget {
  static readonly CLOSED = 2
  static all: FakeSource[] = []
  readonly url: string
  readyState = 1
  constructor(url: string) {
    super()
    this.url = url
    FakeSource.all.push(this)
  }
  close() {
    this.readyState = FakeSource.CLOSED
  }
}

beforeEach(() => {
  FakeSource.all = []
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', FakeSource)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function setup() {
  const onChange = vi.fn()
  const scope = effectScope()
  const live = scope.run(() => useLiveUpdates('e1', onChange))!
  return { onChange, live, scope, source: () => FakeSource.all.at(-1)! }
}

describe('useLiveUpdates', () => {
  it('reloads at a steady pace while changes keep coming, and not for the first connect', () => {
    const { onChange, source } = setup()
    expect(source().url).toBe('/api/examiner/exams/e1/stream')
    source().dispatchEvent(new Event('open'))
    for (let i = 0; i < 10; i++) {
      source().dispatchEvent(new Event('attempt'))
      vi.advanceTimersByTime(200)
    }
    // Events at 0..1800 ms: reloads at 500, 1100, 1700 and 2300 ms — paced, never starved by the steady stream.
    expect(onChange).toHaveBeenCalledTimes(3)
    vi.advanceTimersByTime(500)
    expect(onChange).toHaveBeenCalledTimes(4)
  })

  it('reconnects after an HTTP error the browser gives up on, and reloads what was missed', () => {
    const { onChange, live, scope, source } = setup()
    const first = source()
    first.dispatchEvent(new Event('open'))
    first.readyState = FakeSource.CLOSED
    first.dispatchEvent(new Event('error'))
    expect(live.connected.value).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(FakeSource.all).toHaveLength(2)
    source().dispatchEvent(new Event('open'))
    vi.advanceTimersByTime(500)
    expect(live.connected.value).toBe(true)
    expect(onChange).toHaveBeenCalledTimes(1)
    scope.stop()
    expect(source().readyState).toBe(FakeSource.CLOSED)
  })
})
