import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { ApiError } from '@/shared/lib/http'
import { useLiveRoom } from './live-room'
import { FakeTrack, rooms } from './livekit.fake'

vi.mock('livekit-client', () => import('./livekit.fake'))

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
    // LiveKit reports the track gone while its publication still holds it.
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

  it('rejoins a call the server dropped, with growing pauses and a capped number of times', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { call } = setup()
      let fail = false
      await call.join(() => (fail ? Promise.reject(new TypeError('Failed to fetch')) : access()))
      const drop = (room = rooms.at(-1)!) => {
        room.emit('state', 'disconnected')
        room.emit('disconnected', 'shutdown')
      }
      drop()
      await vi.advanceTimersByTimeAsync(999)
      expect(rooms).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(1)
      expect(rooms).toHaveLength(2)
      expect(call.state.value).toBe('connected')

      // The server stays away: five tries in all, then only the Reconnect button.
      fail = true
      drop()
      await vi.advanceTimersByTimeAsync(600_000)
      expect(rooms).toHaveLength(2 + 5)
      expect(call.state.value).toBe('disconnected')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stays out of a call it was removed from', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const { call } = setup()
      await call.join(access)
      rooms[0]!.emit('state', 'disconnected')
      rooms[0]!.emit('disconnected', 'removed') // the attempt ended
      await vi.advanceTimersByTimeAsync(600_000)
      expect(rooms).toHaveLength(1)
      expect(call.state.value).toBe('disconnected')
    } finally {
      vi.useRealTimers()
    }
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
  it('retries a failed publish and stops its clones', async () => {
    const { call } = setup()
    await call.join(access)
    const room = rooms[0]!
    room.localParticipant.publishTrack.mockRejectedValueOnce(new Error('timeout'))
    call.setLocal(camera())
    await settle()
    const failed = published()
    room.emit('state', 'reconnecting')
    room.emit('state', 'connected') // back: the camera is sent again
    await settle()
    expect(failed.every((t) => t.stopped)).toBe(true)
    expect(published()).toHaveLength(4)
    expect(
      published()
        .slice(2)
        .some((t) => t.stopped),
    ).toBe(false)
  })

  it('stops clones of a failed publish when the camera goes away', async () => {
    const { call } = setup()
    await call.join(access)
    const room = rooms[0]!
    room.localParticipant.publishTrack.mockRejectedValueOnce(new Error('timeout'))
    call.setLocal(camera())
    await settle()
    call.setLocal(null)
    await settle()
    expect(published().every((t) => t.stopped)).toBe(true)
    expect(room.localParticipant.unpublishTrack).toHaveBeenCalledTimes(2)
  })
})
