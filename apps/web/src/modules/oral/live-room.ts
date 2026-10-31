import type { OralRoomAccess } from '@exam/contracts'
import { ConnectionState, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import { onScopeDispose, ref, shallowRef } from 'vue'
import { ApiError } from '@/shared/lib/http'

export type RoomState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'unavailable'

const STATE: Record<ConnectionState, RoomState> = {
  [ConnectionState.Connecting]: 'connecting',
  [ConnectionState.Connected]: 'connected',
  [ConnectionState.Reconnecting]: 'reconnecting',
  [ConnectionState.SignalReconnecting]: 'reconnecting',
  [ConnectionState.Disconnected]: 'disconnected',
}

/**
 * One live video call (student ↔ examiner) through LiveKit.
 * - The local camera is published as clones of its tracks, so the call never stops the camera that
 *   proctoring and the local recording still use. `setLocal` may be called at any time (before joining,
 *   after a camera restart); publishing runs one step at a time and always ends with what was asked last.
 * - The other side's video is exposed as a stream for a muted <video>; its audio is played by LiveKit's
 *   own elements, and `audioBlocked` says when the browser wants a click first (autoplay rules).
 * - After a lost connection the call rejoins when the browser is back online. It ends with its component.
 */
export function useLiveRoom() {
  const state = ref<RoomState>('idle')
  const remote = shallowRef<MediaStream | null>(null)
  const audioBlocked = ref(false)
  let room: Room | null = null
  let getAccess: (() => Promise<OralRoomAccess>) | null = null
  let wanted: MediaStream | null = null
  let sent: { from: MediaStream | null; tracks: MediaStreamTrack[] } = { from: null, tracks: [] }
  let publishing: Promise<void> = Promise.resolve()
  let disposed = false
  const audio = new Set<HTMLMediaElement>()

  function onTrack(current: Room, track: RemoteTrack, subscribed: boolean) {
    if (room !== current) return
    if (track.kind === Track.Kind.Audio) {
      if (subscribed) audio.add(document.body.appendChild(track.attach()))
      else track.detach().forEach((el) => (audio.delete(el), el.remove()))
      return
    }
    // The first camera of the other side; a single tile, so a second participant does not flicker it.
    const video = [...current.remoteParticipants.values()]
      .flatMap((p) => [...p.videoTrackPublications.values()])
      .find((pub) => pub.track)?.track
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
      .on(RoomEvent.ConnectionStateChanged, (s) => room === current && (state.value = STATE[s]))
      .on(RoomEvent.TrackSubscribed, (track) => onTrack(current, track, true))
      .on(RoomEvent.TrackUnsubscribed, (track) => onTrack(current, track, false))
      .on(RoomEvent.AudioPlaybackStatusChanged, () => (audioBlocked.value = !current.canPlaybackAudio))
    try {
      const { url, token } = await access()
      if (room !== current) return
      await current.connect(url, token)
      if (room !== current) return void current.disconnect()
      void sync()
    } catch (error) {
      console.error('could not join the oral exam room', error)
      if (room !== current) return
      room = null
      void current.disconnect()
      state.value = error instanceof ApiError && error.status === 503 ? 'unavailable' : 'disconnected'
    }
  }

  /** What this side sends; null sends nothing. */
  function setLocal(stream: MediaStream | null) {
    wanted = stream
    void sync()
  }

  /** Brings the published tracks in line with `wanted`, one run at a time. */
  function sync(): Promise<void> {
    publishing = publishing.then(async () => {
      const current = room
      if (!current || state.value !== 'connected' || sent.from === wanted) return
      const old = sent
      sent = { from: wanted, tracks: wanted?.getTracks().map((t) => t.clone()) ?? [] }
      // Unpublishing stops the clones (LiveKit's default for local tracks).
      for (const track of old.tracks)
        await current.localParticipant.unpublishTrack(track).catch(() => track.stop())
      for (const track of sent.tracks) {
        if (room !== current) break
        const source = track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone
        await current.localParticipant.publishTrack(track, { source }).catch((error: unknown) => {
          // The call itself goes on: the student still sees and hears the examiner.
          console.error('could not publish', error)
        })
      }
      if (room !== current) sent.tracks.forEach((t) => t.stop())
    })
    return publishing
  }

  async function leave() {
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
  const startAudio = () => room?.startAudio()

  const rejoin = () => state.value === 'disconnected' && getAccess && void join(getAccess)
  window.addEventListener('online', rejoin)
  onScopeDispose(() => {
    disposed = true
    window.removeEventListener('online', rejoin)
    void leave()
  })

  return { state, remote, audioBlocked, join, setLocal, startAudio, leave }
}
