import type { OralRoomAccess } from '@exam/contracts'
import { ConnectionState, DisconnectReason, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { ApiError } from '@/shared/lib/http'

export const ROOM_STATES = [
  'idle',
  'connecting',
  'connected',
  'reconnecting',
  'disconnected',
  'unavailable',
] as const
export type RoomState = (typeof ROOM_STATES)[number]

const STATE: Record<ConnectionState, RoomState> = {
  [ConnectionState.Connecting]: 'connecting',
  [ConnectionState.Connected]: 'connected',
  [ConnectionState.Reconnecting]: 'reconnecting',
  [ConnectionState.SignalReconnecting]: 'reconnecting',
  [ConnectionState.Disconnected]: 'disconnected',
}

/** Waits before each automatic rejoin; after the last one only the Reconnect button is left. */
const RETRY_MS = [1000, 2000, 5000, 10_000, 20_000]
/** Ends on purpose, not lost: we left, the attempt ended (the server removed us) or another tab took over. */
const FINAL = new Set<DisconnectReason | undefined>([
  DisconnectReason.CLIENT_INITIATED,
  DisconnectReason.PARTICIPANT_REMOVED,
  DisconnectReason.DUPLICATE_IDENTITY,
  DisconnectReason.ROOM_DELETED,
])

/**
 * One live video call (student ↔ examiner) through LiveKit.
 * - The camera is published as clones of its tracks, so the call never stops the camera proctoring uses.
 *   `setLocal` may come at any time; publishing runs one step at a time and ends with what was asked last.
 * - The other side's video is a stream for a muted <video>; LiveKit's own elements play its audio, and
 *   `audioBlocked` says when the browser wants a click first.
 * - A lost call (server restart, network drop) rejoins with growing pauses and when back online.
 */
export function useLiveRoom() {
  const state = ref<RoomState>('idle')
  const remote = shallowRef<MediaStream | null>(null)
  const audioBlocked = ref(false)
  let room: Room | null = null
  let getAccess: (() => Promise<OralRoomAccess>) | null = null
  let wanted: MediaStream | null = null
  /** `from` is undefined after a failed run, so the next run always cleans up and retries. */
  let sent: { from: MediaStream | null | undefined; tracks: MediaStreamTrack[] } = { from: null, tracks: [] }
  let publishing: Promise<void> = Promise.resolve()
  let disposed = false
  let tries = 0
  let retry: ReturnType<typeof setTimeout> | undefined
  /** Audio elements by track: LiveKit detaches before it reports the track gone, so they are tracked here. */
  const audio = new Map<RemoteTrack, HTMLMediaElement>()

  function onTrack(current: Room, track: RemoteTrack, subscribed: boolean) {
    if (room !== current) return
    if (track.kind === Track.Kind.Audio) {
      if (subscribed) {
        audio.set(track, document.body.appendChild(track.attach()))
      } else {
        audio.get(track)?.remove()
        audio.delete(track)
      }
      return
    }
    showRemote(current, subscribed ? null : track)
  }

  /**
   * The first camera of the other side (a single tile, so a second participant does not flicker it).
   * `leaving` is excluded: while LiveKit reports a track gone, its publication still holds it.
   */
  function showRemote(current: Room, leaving: RemoteTrack | null = null) {
    if (room !== current) return
    const video = [...current.remoteParticipants.values()]
      .flatMap((p) => [...p.videoTrackPublications.values()])
      .find((pub) => pub.track && pub.track !== leaving && !pub.isMuted)?.track
    if (video?.mediaStreamTrack !== remote.value?.getTracks()[0])
      remote.value = video ? new MediaStream([video.mediaStreamTrack]) : null
  }

  /** Joins with access from `access`; a 503 means live video is not set up on this server. */
  async function join(access: () => Promise<OralRoomAccess>) {
    await leave()
    if (disposed) return
    getAccess = access
    state.value = 'connecting'
    const current = new Room({ dynacast: true })
    room = current
    current
      .on(RoomEvent.ConnectionStateChanged, (s) => {
        if (room !== current) return
        state.value = STATE[s]
        // A camera change made while reconnecting is sent once the call is back.
        if (s === ConnectionState.Connected) {
          tries = 0
          void sync()
        }
      })
      .on(RoomEvent.Disconnected, (reason) => {
        if (room === current && !FINAL.has(reason)) retryLater()
      })
      .on(RoomEvent.TrackSubscribed, (track) => onTrack(current, track, true))
      .on(RoomEvent.TrackUnsubscribed, (track) => onTrack(current, track, false))
      .on(RoomEvent.TrackMuted, () => showRemote(current))
      .on(RoomEvent.TrackUnmuted, () => showRemote(current))
      .on(RoomEvent.ParticipantDisconnected, () => showRemote(current))
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (room === current) audioBlocked.value = !current.canPlaybackAudio
      })
    try {
      const { url, token } = await access()
      if (room !== current) return
      await current.connect(url, token)
      if (room !== current) return void current.disconnect()
    } catch (error) {
      console.error('could not join the oral exam room', error)
      if (room !== current) return
      room = null
      void current.disconnect()
      state.value = error instanceof ApiError && error.status === 503 ? 'unavailable' : 'disconnected'
      // An answer from our server (no access, attempt over, not set up) stays the same on a retry.
      if (!(error instanceof ApiError) || (error.status >= 500 && error.status !== 503)) retryLater()
    }
  }

  /** What this side sends; null sends nothing. */
  function setLocal(stream: MediaStream | null) {
    wanted = stream
    void sync()
  }

  /** Brings the published tracks in line with `wanted`, one run at a time; a failed run is retried next time. */
  function sync(): Promise<void> {
    const run = async () => {
      const current = room
      if (!current || state.value !== 'connected' || sent.from === wanted) return
      const old = sent
      const target = wanted
      sent = { from: undefined, tracks: target?.getTracks().map((t) => t.clone()) ?? [] }
      for (const track of old.tracks) {
        await current.localParticipant.unpublishTrack(track).catch(() => undefined)
        track.stop()
      }
      let ok = true
      for (const track of sent.tracks) {
        if (room !== current) break
        const source = track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone
        await current.localParticipant.publishTrack(track, { source }).catch((error: unknown) => {
          // The call itself goes on: the student still sees and hears the examiner.
          console.error('could not publish', error)
          ok = false
        })
      }
      if (room !== current) return sent.tracks.forEach((t) => t.stop())
      // Only a complete publish counts as done; otherwise the next change or reconnect tries again.
      if (ok) sent.from = target
    }
    publishing = publishing.then(run, run)
    return publishing
  }

  function retryLater() {
    if (retry !== undefined) return // one drop can be reported twice (a failed join, then its disconnect)
    const wait = RETRY_MS[tries++]
    if (wait !== undefined) retry = setTimeout(() => ((retry = undefined), rejoin()), wait)
  }

  async function leave() {
    clearTimeout(retry)
    retry = undefined
    const current = room
    room = null
    sent.tracks.forEach((t) => t.stop())
    sent = { from: null, tracks: [] }
    audio.forEach((el) => el.remove())
    audio.clear()
    remote.value = null
    audioBlocked.value = false
    if (state.value !== 'unavailable') state.value = 'idle'
    await current?.disconnect()
  }

  /** Lets the remote audio play after a click (browsers block sound that starts on its own). */
  const startAudio = () =>
    room?.startAudio().catch((error: unknown) => console.error('sound still blocked', error))

  const rejoin = () => state.value === 'disconnected' && getAccess && void join(getAccess)
  window.addEventListener('online', rejoin)
  onScopeDispose(() => {
    disposed = true
    window.removeEventListener('online', rejoin)
    void leave()
  })

  return { state, remote, audioBlocked, join, setLocal, startAudio, leave }
}
