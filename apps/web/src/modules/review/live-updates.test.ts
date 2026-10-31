import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useLiveUpdates } from './live-updates'

class FakeSource extends EventTarget {
  static last: FakeSource
  closed = false
  readonly url: string
  constructor(url: string) {
    super()
    this.url = url
    FakeSource.last = this
  }
  close() {
    this.closed = true
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('EventSource', FakeSource)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useLiveUpdates', () => {
  it('reloads once per burst of changes and closes the stream with the page', () => {
    const onChange = vi.fn()
    const scope = effectScope()
    const live = scope.run(() => useLiveUpdates('e1', onChange))!
    const source = FakeSource.last
    expect(source.url).toBe('/api/examiner/exams/e1/stream')

    source.dispatchEvent(new Event('open'))
    expect(live.connected.value).toBe(true)
    source.dispatchEvent(new Event('attempt'))
    source.dispatchEvent(new Event('attempt'))
    vi.advanceTimersByTime(300)
    expect(onChange).toHaveBeenCalledTimes(1)

    source.dispatchEvent(new Event('error'))
    expect(live.connected.value).toBe(false)
    scope.stop()
    expect(source.closed).toBe(true)
  })
})
