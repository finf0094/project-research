/** Releases a camera/microphone stream: the device light goes off. */
export function stopTracks(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop())
}
