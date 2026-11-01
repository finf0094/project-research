import { vi } from 'vitest'

/**
 * Just enough of livekit-client for the call's tests: a Room with events, connect (which reports
 * "connected") and publishing, the enums the code reads, and tracks that can be cloned and stopped.
 */
type Handler = (...args: unknown[]) => void
type Publication = { track?: { mediaStreamTrack: unknown }; isMuted?: boolean }

export const rooms: Room[] = []

export class Room {
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

export const RoomEvent = {
  ConnectionStateChanged: 'state',
  TrackSubscribed: 'subscribed',
  TrackUnsubscribed: 'unsubscribed',
  AudioPlaybackStatusChanged: 'audio',
  TrackMuted: 'muted',
  TrackUnmuted: 'unmuted',
  ParticipantDisconnected: 'left',
  Disconnected: 'disconnected',
}

export const DisconnectReason = {
  UNKNOWN_REASON: 'unknown',
  CLIENT_INITIATED: 'client',
  DUPLICATE_IDENTITY: 'duplicate',
  SERVER_SHUTDOWN: 'shutdown',
  PARTICIPANT_REMOVED: 'removed',
  ROOM_DELETED: 'deleted',
}

export const ConnectionState = {
  Connecting: 'connecting',
  Connected: 'connected',
  Reconnecting: 'reconnecting',
  SignalReconnecting: 'signalReconnecting',
  Disconnected: 'disconnected',
}

export const Track = {
  Source: { Camera: 'camera', Microphone: 'microphone' },
  Kind: { Audio: 'audio', Video: 'video' },
}

export class FakeTrack {
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
