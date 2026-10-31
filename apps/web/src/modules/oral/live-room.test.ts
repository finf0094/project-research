import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '@/shared/lib/http'
import { useLiveRoom } from './live-room'

const { FakeRoom, rooms } = vi.hoisted(() => {
  const rooms: InstanceType<typeof FakeRoom>[] = []
  class FakeRoom {
    handlers = new Map<string, (...args: unknown[]) => void>()
    remoteParticipants = new Map<
      string,
      { trackPublications: Map<string, { track?: { mediaStreamTrack: unknown } }> }
    >()
    localParticipant = {
      publishTrack: vi.fn(async (_track: unknown, _options?: unknown) => undefined),
      unpublishTrack: vi.fn(async (_track: unknown, _options?: unknown) => undefined),
    }
    connect = vi.fn(async () => undefined)
    disconnect = vi.fn(async () => undefined)
    constructor() {
      rooms.push(this)
    }
    on(event: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(event, handler)
      return this
    }
    emit(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.(...args)
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
    ParticipantDisconnected: 'left',
  },
  ConnectionState: {
    Connecting: 'connecting',
    Connected: 'connected',
    Reconnecting: 'reconnecting',
    SignalReconnecting: 'signalReconnecting',
    Disconnected: 'disconnected',
  },
  Track: { Source: { Camera: 'camera', Microphone: 'microphone' } },
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
    const camera = [new FakeTrack('video'), new FakeTrack('audio')]
    const { call } = setup()
    await call.join(access, new MediaStream(camera as never))
    expect(call.state.value).toBe('connected')
    const published = rooms[0]!.localParticipant.publishTrack.mock.calls.map(
      (c) => c[0] as unknown as FakeTrack,
    )
    expect(published).toHaveLength(2)
    expect(published.some((t) => camera.includes(t))).toBe(false)

    await call.leave()
    expect(published.every((t) => t.stopped)).toBe(true)
    expect(camera.some((t) => t.stopped)).toBe(false)
    expect(rooms[0]!.disconnect).toHaveBeenCalled()
  })

  it('shows the other side once their track arrives and drops it when they leave', async () => {
    const { call } = setup()
    await call.join(access)
    const room = rooms[0]!
    const pubs = new Map([['v', { track: { mediaStreamTrack: new FakeTrack('video') } }]])
    room.remoteParticipants.set('examiner', { trackPublications: pubs })
    room.emit('subscribed')
    expect(call.remote.value).not.toBeNull()
    room.remoteParticipants.clear()
    room.emit('left')
    expect(call.remote.value).toBeNull()
  })

  it('tells "not configured" (503) apart from a lost connection', async () => {
    const { call } = setup()
    await call.join(() => Promise.reject(new ApiError(503, 'Oral exams are not configured')))
    expect(call.state.value).toBe('unavailable')
    await call.join(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(call.state.value).toBe('disconnected')
  })

  it('follows reconnects and leaves the call when the page goes away', async () => {
    const { call, dispose } = setup()
    await call.join(access)
    rooms[0]!.emit('state', 'reconnecting')
    expect(call.state.value).toBe('reconnecting')
    dispose()
    expect(rooms[0]!.disconnect).toHaveBeenCalled()
  })
})
