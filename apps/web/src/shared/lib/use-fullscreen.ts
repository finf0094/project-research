import { onScopeDispose, ref } from 'vue'

/** The page in fullscreen and back; follows Esc and the browser's own controls. */
export function useFullscreen() {
  const supported = !!document.fullscreenEnabled
  const active = ref(!!document.fullscreenElement)
  const sync = () => (active.value = !!document.fullscreenElement)
  document.addEventListener('fullscreenchange', sync)
  onScopeDispose(() => document.removeEventListener('fullscreenchange', sync))

  async function toggle() {
    // Refusals (no user gesture, a policy) leave the page as it is. iPhone Safari has no page
    // fullscreen at all (the methods are missing, not refusing): nothing happens there either.
    try {
      if (document.fullscreenElement) await document.exitFullscreen?.()
      else await document.documentElement.requestFullscreen?.()
    } catch {
      /* the page stays as it is */
    }
  }
  return { supported, active, toggle }
}
