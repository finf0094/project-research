/** Releases a camera/microphone stream: the device light goes off. */
export function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop())
}

/** Why the camera could not be opened, in words a person can act on. */
export type CameraProblem = 'denied' | 'busy' | 'missing' | 'other'

export function cameraProblem(error: unknown): CameraProblem {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'missing'
  return 'other'
}
