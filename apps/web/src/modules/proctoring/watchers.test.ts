import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchAll, watchBrowser } from './watchers'

describe('watchers on Safari', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('runs where `screen` is no event target (iPhone): the second-screen check just stays silent', () => {
    vi.stubGlobal('screen', { width: 390 })
    const stop = watchBrowser(() => undefined)
    expect(stop).not.toThrow()
  })

  it('skips a watcher that cannot run instead of failing the whole proctoring', () => {
    vi.stubGlobal('navigator', { mediaDevices: undefined })
    const stream = { getAudioTracks: () => [], getVideoTracks: () => [] } as unknown as MediaStream
    const signals: string[] = []
    const stop = watchAll(stream, (kind, on) => signals.push(`${kind}:${on}`))
    expect(stop).not.toThrow()
  })
})
