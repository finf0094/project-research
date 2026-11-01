import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventLog } from '@/modules/offline'

const camera = vi.hoisted(() => ({
  requests: [] as { resolve: (m: MediaStream) => void; reject: (e: Error) => void }[],
}))
vi.mock('./sensors', () => ({
  requestCamera: () =>
    new Promise<MediaStream>((resolve, reject) => camera.requests.push({ resolve, reject })),
}))
vi.mock('./proctor', () => ({
  startProctor: async () => ({ capture: vi.fn(), stop: vi.fn(async () => undefined) }),
}))

const { useProctoringStore } = await import('./proctoring.store')

function fakeMedia() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() })
  return { media: { getTracks: () => [track] } as unknown as MediaStream, track }
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

beforeEach(() => {
  setActivePinia(createPinia())
  camera.requests = []
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

  it('records a lost camera once, and its return', async () => {
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
    await vi.waitFor(() => expect(store.camera).toBe('blocked'))
    expect(appended).toEqual([{ kind: 'camera_off', active: true }])

    const retried = store.retry()
    await vi.waitFor(() => expect(camera.requests).toHaveLength(2))
    camera.requests[1]!.resolve(fakeMedia().media)
    await retried
    expect(appended).toEqual([
      { kind: 'camera_off', active: true },
      { kind: 'camera_off', active: false },
    ])
  })
})
