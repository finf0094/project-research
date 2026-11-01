import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchCameraMute, watchDevices, watchMicrophone } from './devices'

function setup(camera: string, microphone: string, output = 'Default - Speakers') {
  const events = new EventTarget()
  vi.stubGlobal('navigator', {
    mediaDevices: Object.assign(events, {
      enumerateDevices: async () => [{ kind: 'audiooutput', deviceId: 'default', label: output }],
    }),
  })
  const stream = {
    getVideoTracks: () => [{ label: camera }],
    getAudioTracks: () => [{ label: microphone }],
  } as unknown as MediaStream
  const signals: [string, boolean][] = []
  const stop = watchDevices(stream, (kind, on) => signals.push([kind, on]))
  return { signals, stop, events }
}

describe('devices in use', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sees a virtual camera and headphones by their names', async () => {
    const { signals } = setup('OBS Virtual Camera', 'AirPods Pro')
    await vi.waitFor(() =>
      expect(signals).toEqual([
        ['virtual_camera', true],
        ['headphones', true],
      ]),
    )
  })

  it('sees headphones that only play the sound, and nothing on a plain laptop', async () => {
    const headset = setup('FaceTime HD Camera', 'MacBook Pro Microphone', 'Default - Наушники (Realtek)')
    await vi.waitFor(() => expect(headset.signals).toContainEqual(['headphones', true]))
    vi.unstubAllGlobals()
    const plain = setup('Integrated Webcam', 'Microphone Array (Realtek)')
    await vi.waitFor(() =>
      expect(plain.signals).toEqual([
        ['virtual_camera', false],
        ['headphones', false],
      ]),
    )
  })

  it('sees "Buds2", and not the laptop jack that Windows names "Speakers/Headphones"', async () => {
    const buds = setup('Webcam', 'Galaxy Buds2 Pro')
    await vi.waitFor(() => expect(buds.signals).toContainEqual(['headphones', true]))
    vi.unstubAllGlobals()
    const jack = setup(
      'Webcam',
      'Microphone Array (Realtek)',
      'Default - Speakers/Headphones (Realtek(R) Audio)',
    )
    await vi.waitFor(() => expect(jack.signals).toContainEqual(['headphones', false]))
  })

  it('checks again when a device is plugged in', async () => {
    const { signals, events, stop } = setup('Webcam', 'Microphone')
    await vi.waitFor(() => expect(signals).toHaveLength(2))
    events.dispatchEvent(new Event('devicechange'))
    await vi.waitFor(() => expect(signals).toHaveLength(4))
    stop()
  })
})

describe('microphone muted', () => {
  function microphone(muted: boolean) {
    const track = Object.assign(new EventTarget(), { muted, readyState: 'live' as MediaStreamTrackState })
    const stream = { getAudioTracks: () => [track] } as unknown as MediaStream
    const signals: boolean[] = []
    const stop = watchMicrophone(stream, (_, on) => signals.push(on))
    return { track, signals, stop }
  }
  afterEach(() => vi.useRealTimers())

  it('ignores the short mute iOS reports at the start', () => {
    vi.useFakeTimers()
    const { track, signals, stop } = microphone(true)
    vi.advanceTimersByTime(500)
    track.muted = false
    track.dispatchEvent(new Event('unmute'))
    vi.advanceTimersByTime(5000)
    expect(signals).not.toContain(true)
    stop()
  })

  it('counts a mute that lasts, and an ended track at once', () => {
    vi.useFakeTimers()
    const { track, signals, stop } = microphone(true)
    vi.advanceTimersByTime(2000)
    expect(signals.at(-1)).toBe(true)
    track.muted = false
    track.dispatchEvent(new Event('unmute'))
    expect(signals.at(-1)).toBe(false)
    track.readyState = 'ended'
    track.dispatchEvent(new Event('ended'))
    expect(signals.at(-1)).toBe(true)
    stop()
  })
})

describe('mute while the page is hidden (iPhone in the background)', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
  function setup(watch: typeof watchMicrophone) {
    let visibility: DocumentVisibilityState = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility)
    const track = Object.assign(new EventTarget(), {
      muted: false,
      readyState: 'live' as MediaStreamTrackState,
    })
    const stream = { getAudioTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream
    const signals: string[] = []
    const stop = watch(stream, (kind, on) => signals.push(`${kind}:${on}`))
    const hide = (hidden: boolean) => {
      visibility = hidden ? 'hidden' : 'visible'
      document.dispatchEvent(new Event('visibilitychange'))
    }
    const mute = (muted: boolean) => {
      track.muted = muted
      track.dispatchEvent(new Event(muted ? 'mute' : 'unmute'))
    }
    return { signals, stop, hide, mute }
  }

  it('does not count the mute iOS puts on a page in the background, even when the unmute comes late', () => {
    vi.useFakeTimers()
    const { signals, stop, hide, mute } = setup(watchMicrophone)
    hide(true)
    mute(true)
    vi.advanceTimersByTime(10_000)
    hide(false)
    vi.advanceTimersByTime(1000) // the unmute comes a moment after the page is back
    mute(false)
    vi.advanceTimersByTime(5000)
    expect(signals).not.toContain('mic_off:true')
    stop()
  })

  it('still counts a mute that lasts after the page is back', () => {
    vi.useFakeTimers()
    const { signals, stop, hide, mute } = setup(watchMicrophone)
    hide(true)
    mute(true)
    hide(false)
    vi.advanceTimersByTime(2000)
    expect(signals.at(-1)).toBe('mic_off:true')
    stop()
  })

  it('counts a camera the system keeps muted while the page is shown (a frozen picture)', () => {
    vi.useFakeTimers()
    const { signals, stop, mute } = setup(watchCameraMute)
    mute(true)
    vi.advanceTimersByTime(2000)
    expect(signals.at(-1)).toBe('camera_off:true')
    mute(false)
    expect(signals.at(-1)).toBe('camera_off:false')
    stop()
  })
})
