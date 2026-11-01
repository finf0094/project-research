import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventLog } from '@/modules/offline'
import type { StartOptions } from './proctoring.store'

const camera = vi.hoisted(() => ({
  requests: [] as { resolve: (m: MediaStream) => void; reject: (e: Error) => void }[],
}))
vi.mock('./sensors', () => ({
  requestCamera: () =>
    new Promise<MediaStream>((resolve, reject) => camera.requests.push({ resolve, reject })),
}))
const proctor = vi.hoisted(() => ({
  start: async (_media: MediaStream, _options: { log: EventLog }) => ({
    capture: () => undefined,
    stop: async (_discard?: boolean) => undefined,
  }),
}))
vi.mock('./proctor', () => ({
  startProctor: (...args: Parameters<typeof proctor.start>) => proctor.start(...args),
}))

const { useProctoringStore } = await import('./proctoring.store')

function fakeMedia() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  return {
    media: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
    track,
  }
}

function fakeLog() {
  const appended: unknown[] = []
  const log: EventLog = {
    append: async (_type, data) => void appended.push(data),
    head: () => ({ seq: 0, hash: '' }),
  }
  return { log, appended }
}

const flush = () => new Promise((r) => setTimeout(r, 0))

const defaultStart = proctor.start

beforeEach(() => {
  setActivePinia(createPinia())
  camera.requests = []
  proctor.start = defaultStart
})

const options = (log: EventLog): StartOptions => ({
  attemptId: 'a',
  log,
  recording: 'adaptive',
  listen: true,
  ignore: [],
  now: () => 0,
})

describe('proctoring store lifecycle', () => {
  it('a stop during the camera prompt does not wait for it, and a late camera is released', async () => {
    const store = useProctoringStore()
    const { log, appended } = fakeLog()
    void store.start({ attemptId: 'a', log, recording: 'adaptive', listen: true, ignore: [], now: () => 0 })
    await flush()
    await store.stop() // resolves although the prompt is still open
    const { media, track } = fakeMedia()
    camera.requests[0]!.resolve(media)
    await flush()
    expect(track.stop).toHaveBeenCalled()
    expect(store.camera).toBe('off')
    expect(appended).toEqual([])
  })

  it('starts again after a stop that interrupted an earlier start', async () => {
    const store = useProctoringStore()
    const { log } = fakeLog()
    void store.start({ attemptId: 'a', log, recording: 'adaptive', listen: true, ignore: [], now: () => 0 })
    await flush()
    void store.stop()
    const restarted = store.start({
      attemptId: 'a',
      log,
      recording: 'adaptive',
      listen: true,
      ignore: [],
      now: () => 0,
    })
    await vi.waitFor(() => expect(camera.requests).toHaveLength(2))
    camera.requests[1]!.resolve(fakeMedia().media)
    await restarted
    expect(store.camera).toBe('on')
  })

  it('records a lost camera once, asks for it again by itself, and records its return', async () => {
    const store = useProctoringStore()
    const { log, appended } = fakeLog()
    const started = store.start({
      attemptId: 'a',
      log,
      recording: 'adaptive',
      listen: true,
      ignore: [],
      now: () => 0,
    })
    await flush()
    const { media, track } = fakeMedia()
    camera.requests[0]!.resolve(media)
    await started
    track.dispatchEvent(new Event('ended'))
    await vi.waitFor(() => expect(camera.requests).toHaveLength(2))
    expect(appended).toEqual([{ kind: 'camera_off', active: true }])

    camera.requests[1]!.resolve(fakeMedia().media)
    await vi.waitFor(() => expect(store.camera).toBe('on'))
    await vi.waitFor(() =>
      expect(appended).toEqual([
        { kind: 'camera_off', active: true },
        { kind: 'camera_off', active: false },
      ]),
    )
  })

  it('releases the camera when proctoring fails to start, so a retry does not open a second one', async () => {
    proctor.start = async () => {
      throw new Error('no MediaRecorder')
    }
    const store = useProctoringStore()
    const { log, appended } = fakeLog()
    const started = store.start(options(log))
    await flush()
    const { media, track } = fakeMedia()
    camera.requests[0]!.resolve(media)
    await started
    expect(track.stop).toHaveBeenCalled()
    expect(store.camera).toBe('blocked')
    expect(appended).toEqual([{ kind: 'camera_off', active: true }])
  })

  it('an aborted start that finishes late is discarded and writes nothing to the chain', async () => {
    let finishStart = () => {}
    const stop = vi.fn(async (_discard?: boolean) => undefined)
    let given: EventLog | null = null
    proctor.start = (_media, opts) => {
      given = opts.log
      return new Promise((resolve) => (finishStart = () => resolve({ capture: () => undefined, stop })))
    }
    const store = useProctoringStore()
    const { log, appended } = fakeLog()
    void store.start(options(log))
    await flush()
    camera.requests[0]!.resolve(fakeMedia().media)
    await vi.waitFor(() => expect(given).not.toBeNull())
    await store.stop()
    finishStart()
    await flush()
    expect(stop).toHaveBeenCalledWith(true)
    await given!.append('proctoring.mode', { tier: 'lite' })
    expect(appended).toEqual([])
  })
})
