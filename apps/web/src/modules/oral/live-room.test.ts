import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '@/shared/lib/http'
import { useLiveRoom } from './live-room'

type Handler = (...args: unknown[]) => void
type Publication = { track?: { mediaStreamTrack: unknown } }

const { FakeRoom, rooms } = vi.hoisted(() => {
  const rooms: InstanceType<typeof FakeRoom>[] = []
  /** Just enough of livekit-client's Room: events, connect (which reports "connected") and publishing. */
  class FakeRoom {
    handlers = new Map<string, Handler[]>()
    remoteParticipants = new Map<string, { videoTrackPublications: Map<string, Publication> }>()
    canPlaybackAudio = true
    localParticipant = {
      publishTrack: vi.fn(async (_track: unknown, _options?: unknown) => undefined),
      unpublishTrack: vi.fn(async (track: { stop(): void }) => track.stop()),
    }
    connect = vi.fn(async () => this.emit('state', 'connected'))
    disconnect = vi.fn(async () => undefined)
    startAudio = vi.fn(async () => undefined)
    constructor() {
      rooms.push(this)
    }
    on(event: string, handler: Handler) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler])
      return this
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.forEach((h) => h(...args))
    }
  }
  return { FakeRoom, rooms }
})

vi.mock('livekit-client', () => ({
  Room: FakeRoom,
  RoomEvent: {
    ConnectionStateChanged: 'state',
    TrackSubscribed: 'subscribed',
    TrackUnsubscribed: 'unsubscribed',
    AudioPlaybackStatusChanged: 'audio',
  },
  ConnectionState: {
    Connecting: 'connecting',
    Connected: 'connected',
    Reconnecting: 'reconnecting',
    SignalReconnecting: 'signalReconnecting',
    Disconnected: 'disconnected',
  },
  Track: { Source: { Camera: 'camera', Microphone: 'microphone' }, Kind: { Audio: 'audio', Video: 'video' } },
}))

class FakeTrack {
  stopped = false
  readonly kind: 'video' | 'audio'
  constructor(kind: 'video' | 'audio') {
    this.kind = kind
  }
  clone() {
    return new FakeTrack(this.kind)
  }
  stop() {
    this.stopped = true
  }
}

const access = async () => ({ url: 'wss://live.test', token: 't', room: 'attempt-1' })
const camera = () => new MediaStream([new FakeTrack('video'), new FakeTrack('audio')] as never)
const published = (room = rooms[0]!) =>
  room.localParticipant.publishTrack.mock.calls.map((c) => c[0] as unknown as FakeTrack)
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  rooms.length = 0
  vi.stubGlobal(
    'MediaStream',
    class {
      private tracks: unknown[]
      constructor(tracks: unknown[] = []) {
        this.tracks = tracks
      }
      getTracks() {
        return this.tracks
      }
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

function setup() {
  const scope = effectScope()
  const call = scope.run(() => useLiveRoom())!
  return { call, dispose: () => scope.stop() }
}

describe('useLiveRoom', () => {
  it('publishes clones of the camera, so leaving the call never stops the recording camera', async () => {
    const stream = camera()
    const { call } = setup()
    call.setLocal(stream)
    await call.join(access)
    await settle()
    expect(call.state.value).toBe('connected')
    const sent = published()
    expect(sent).toHaveLength(2)
    expect(sent.some((t) => stream.getTracks().includes(t as never))).toBe(false)

    await call.leave()
    expect(sent.every((t) => t.stopped)).toBe(true)
    expect(stream.getTracks().some((t) => (t as unknown as FakeTrack).stopped)).toBe(false)
  })

  it('publishes a camera that arrives after joining, and replaces it after a restart', async () => {
    const { call } = setup()
    await call.join(access)
    call.setLocal(camera())
    call.setLocal(camera()) // two changes in a row: one run at a time, only the last one is sent
    await settle()
    expect(published()).toHaveLength(2)
    call.setLocal(camera()) // the camera restarted
    await settle()
    const sent = published()
    expect(sent).toHaveLength(4)
    expect(sent.slice(0, 2).every((t) => t.stopped)).toBe(true)
    expect(sent.slice(2).some((t) => t.stopped)).toBe(false)
  })

  it('shows the other side once their camera arrives', async () => {
    const { call } = setup()
    await call.join(access)
    const room = rooms[0]!
    const video = { kind: 'video', mediaStreamTrack: new FakeTrack('video') }
    room.remoteParticipants.set('examiner', { videoTrackPublications: new Map([['v', { track: video }]]) })
    room.emit('subscribed', video)
    expect(call.remote.value).not.toBeNull()
    room.remoteParticipants.clear()
    room.emit('unsubscribed', video)
    expect(call.remote.value).toBeNull()
  })

  it('tells "not configured" (503) apart from a lost connection, and rejoins when back online', async () => {
    const { call } = setup()
    await call.join(() => Promise.reject(new ApiError(503, 'Oral exams are not configured')))
    expect(call.state.value).toBe('unavailable')
    let fail = true
    await call.join(() => (fail ? Promise.reject(new TypeError('Failed to fetch')) : access()))
    expect(call.state.value).toBe('disconnected')
    fail = false
    window.dispatchEvent(new Event('online'))
    await settle()
    expect(call.state.value).toBe('connected')
  })

  it('never leaves a call open after the page is gone, even when joining finishes later', async () => {
    const { call, dispose } = setup()
    let grant: () => void = () => undefined
    const slow = () => new Promise<void>((resolve) => (grant = resolve)).then(access)
    const joining = call.join(slow)
    await settle() // the room exists, the token request is still on its way
    expect(rooms).toHaveLength(1)
    dispose()
    grant()
    await joining
    expect(rooms[0]!.connect).not.toHaveBeenCalled()
    await call.join(access) // a late join after dispose does nothing
    expect(rooms).toHaveLength(1)
  })

  it('asks for a click when the browser blocks the sound', async () => {
    const { call } = setup()
    await call.join(access)
    rooms[0]!.canPlaybackAudio = false
    rooms[0]!.emit('audio')
    expect(call.audioBlocked.value).toBe(true)
    await call.startAudio()
    expect(rooms[0]!.startAudio).toHaveBeenCalled()
  })
})
