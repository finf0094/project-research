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

  it('counts text dropped in from another window as a paste, but not a drag within the page', () => {
    const signals: string[] = []
    const stop = watchBrowser((kind, on) => kind === 'paste' && on && signals.push(kind))
    const drop = (text: string) => {
      const event = new Event('drop', { bubbles: true })
      Object.assign(event, { dataTransfer: { getData: () => text } })
      document.body.dispatchEvent(event)
    }
    drop('a whole paragraph found somewhere else')
    expect(signals).toEqual(['paste'])
    document.body.dispatchEvent(new Event('dragstart', { bubbles: true }))
    drop('the question text dragged into the answer')
    document.body.dispatchEvent(new Event('dragend', { bubbles: true }))
    expect(signals).toEqual(['paste'])
    stop()
  })
})
