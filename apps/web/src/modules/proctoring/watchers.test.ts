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

  it('clears "tab hidden" on return even where hasFocus() still reads false (iPhone)', () => {
    let visibility: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const signals: string[] = []
    const stop = watchBrowser((kind, on) => kind === 'tab_hidden' && signals.push(String(on)))
    visibility = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    visibility = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(signals).toEqual(['true', 'false'])
    stop()
    vi.restoreAllMocks()
  })

  it('still counts another window in front once the blur lasts (desktop)', () => {
    vi.useFakeTimers()
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    const signals: string[] = []
    const stop = watchBrowser((kind, on) => kind === 'tab_hidden' && signals.push(String(on)))
    window.dispatchEvent(new Event('blur'))
    vi.advanceTimersByTime(2000)
    window.dispatchEvent(new Event('focus'))
    expect(signals).toEqual(['true', 'false'])
    stop()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
})
