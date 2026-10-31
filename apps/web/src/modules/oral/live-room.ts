import type { OralRoomAccess } from '@exam/contracts'
import { ConnectionState, Room, RoomEvent, Track } from 'livekit-client'
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
 * One live video call (student ↔ examiner) through LiveKit. The local camera is published as clones of
 * the tracks, so leaving the call never stops the camera that proctoring and local recording still use.
 * The call ends with the component that started it.
 */
export function useLiveRoom() {
  const state = ref<RoomState>('idle')
  const remote = shallowRef<MediaStream | null>(null)
  let room: Room | null = null
  let published: MediaStreamTrack[] = []

  function refreshRemote(current: Room) {
    const tracks = [...current.remoteParticipants.values()].flatMap((p) =>
      [...p.trackPublications.values()].flatMap((pub) => (pub.track ? [pub.track.mediaStreamTrack] : [])),
    )
    remote.value = tracks.length ? new MediaStream(tracks) : null
  }

  /** Joins with access from `getAccess`; a 503 means live video is not set up on this server. */
  async function join(getAccess: () => Promise<OralRoomAccess>, local?: MediaStream | null) {
    await leave()
    state.value = 'connecting'
    const current = new Room({ adaptiveStream: true, dynacast: true })
    room = current
    current
      .on(RoomEvent.ConnectionStateChanged, (s) => room === current && (state.value = STATE[s]))
      .on(RoomEvent.TrackSubscribed, () => refreshRemote(current))
      .on(RoomEvent.TrackUnsubscribed, () => refreshRemote(current))
      .on(RoomEvent.ParticipantDisconnected, () => refreshRemote(current))
    try {
      const access = await getAccess()
      await current.connect(access.url, access.token)
      if (room !== current) return void current.disconnect()
      state.value = 'connected'
      if (local) await publish(local)
    } catch (error) {
      console.error('could not join the oral exam room', error)
      if (room !== current) return
      room = null
      void current.disconnect()
      state.value = error instanceof ApiError && error.status === 503 ? 'unavailable' : 'disconnected'
    }
  }

  /** Replaces what this side sends (e.g. after the camera was restarted). */
  async function publish(local: MediaStream | null) {
    const current = room
    if (!current) return
    for (const track of published) {
      await current.localParticipant.unpublishTrack(track)
      track.stop()
    }
    published = local ? local.getTracks().map((t) => t.clone()) : []
    for (const track of published) {
      const source = track.kind === 'video' ? Track.Source.Camera : Track.Source.Microphone
      await current.localParticipant.publishTrack(track, { source })
    }
  }

  async function leave() {
    const current = room
    room = null
    published.forEach((t) => t.stop())
    published = []
    remote.value = null
    if (state.value !== 'unavailable') state.value = 'idle'
    await current?.disconnect()
  }

  onScopeDispose(() => void leave())
  return { state, remote, join, publish, leave }
}
