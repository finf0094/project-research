import { onScopeDispose, ref } from 'vue'
import { cameraProblem, stopTracks, type CameraProblem } from '@/shared/lib/media'

/**
 * The examiner's own camera and microphone for the call. A dead or missing one is asked for again, and
 * a stream granted after the page has gone (the permission prompt was still open) is stopped at once.
 */
export function useOwnCamera() {
  const missing = ref(false)
  const problem = ref<CameraProblem>('other')
  let stream: MediaStream | null = null
  let disposed = false

  async function ensure(): Promise<MediaStream | null> {
    if (stream?.getTracks().some((t) => t.readyState === 'live')) return stream
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      if (disposed) {
        stopTracks(media)
        return null
      }
      stream = media
      missing.value = false
    } catch (error) {
      console.error('own camera', error)
      problem.value = cameraProblem(error)
      missing.value = true
    }
    return stream
  }

  function stop() {
    stopTracks(stream)
    stream = null
  }

  onScopeDispose(() => {
    disposed = true
    stop()
  })
  return { missing, problem, ensure, stop }
}
