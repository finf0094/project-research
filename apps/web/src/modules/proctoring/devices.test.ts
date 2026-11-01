import { afterEach, describe, expect, it, vi } from 'vitest'
import { watchDevices } from './devices'

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
