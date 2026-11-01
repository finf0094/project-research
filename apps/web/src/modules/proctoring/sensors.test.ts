import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSensors } from './sensors'

/** Stands in for the detector worker; the test plays its replies. */
class FakeWorker {
  static last: FakeWorker
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: { message: string }) => void) | null = null
  posted: { type: string; id?: number }[] = []
  terminated = false
  constructor() {
    FakeWorker.last = this
  }
  postMessage(message: { type: string; id?: number }) {
    this.posted.push(message)
  }
  reply(data: unknown) {
    this.onmessage?.({ data })
  }
  terminate() {
    this.terminated = true
  }
}

class FakeAudio {
  state = 'running'
  createAnalyser = () => ({ fftSize: 0, getFloatTimeDomainData: () => undefined })
  createMediaStreamSource = () => ({ connect: () => undefined })
  close = async () => undefined
}

beforeEach(() => {
  vi.stubGlobal('Worker', FakeWorker)
  vi.stubGlobal('AudioContext', FakeAudio)
  vi.stubGlobal('createImageBitmap', async () => ({ close: vi.fn() }))
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// happy-dom checks the type of srcObject; an empty stream is enough here.
const stream = new MediaStream()
const baseline = { yaw: 0, pitch: 0 }
const report = { faces: 1, lookingAway: false, pose: null, object: null, brightness: 120, ms: 12 }

async function started() {
  const sensors = createSensors(stream, 'lite', baseline)
  await vi.waitFor(() => expect(FakeWorker.last?.posted[0]?.type).toBe('init'))
  FakeWorker.last.reply({ type: 'ready' })
  return { sensors: await sensors, worker: FakeWorker.last }
}

describe('createSensors', () => {
  it('matches each report to its frame', async () => {
    const { sensors, worker } = await started()
    const first = sensors.analyze(false)
    const second = sensors.analyze(true)
    await vi.waitFor(() => expect(worker.posted.filter((m) => m.type === 'frame')).toHaveLength(2))
    const [a, b] = worker.posted.filter((m) => m.type === 'frame')
    worker.reply({ type: 'report', id: b!.id, report: { ...report, faces: 2 } })
    worker.reply({ type: 'report', id: a!.id, report })
    expect((await first)?.faces).toBe(1)
    expect((await second)?.faces).toBe(2)
  })

  it('does not hang when the worker cannot start; the exam goes on without measurements', async () => {
    const sensors = createSensors(stream, 'full', baseline)
    await vi.waitFor(() => expect(FakeWorker.last?.posted).toHaveLength(1))
    FakeWorker.last.onerror?.({ message: 'chunk not found' })
    expect(await (await sensors).analyze(true)).toBeNull()
  })

  it('fails instead of waiting forever when the models do not load', async () => {
    vi.useFakeTimers()
    try {
      const sensors = createSensors(stream, 'full', baseline)
      const failed = expect(sensors).rejects.toThrow()
      await vi.advanceTimersByTimeAsync(60_000)
      await failed
      expect(FakeWorker.last.terminated).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports a worker that dies mid-exam as dead', async () => {
    const { sensors, worker } = await started()
    expect(sensors.dead()).toBe(false)
    worker.onerror?.({ message: 'out of memory' })
    expect(sensors.dead()).toBe(true)
    expect(await sensors.analyze(false)).toBeNull()
  })

  it('settles waiting frames when the page goes away', async () => {
    const { sensors, worker } = await started()
    const waiting = sensors.analyze(false)
    await vi.waitFor(() => expect(worker.posted.some((m) => m.type === 'frame')).toBe(true))
    sensors.dispose()
    expect(await waiting).toBeNull()
    expect(worker.terminated).toBe(true)
    expect(await sensors.analyze(false)).toBeNull()
  })
})
