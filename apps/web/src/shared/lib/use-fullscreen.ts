import { onScopeDispose, ref } from 'vue'

/** The page in fullscreen and back; follows Esc and the browser's own controls. */
export function useFullscreen() {
  const supported = !!document.fullscreenEnabled
  const active = ref(!!document.fullscreenElement)
  const sync = () => (active.value = !!document.fullscreenElement)
  document.addEventListener('fullscreenchange', sync)
  onScopeDispose(() => document.removeEventListener('fullscreenchange', sync))

  async function toggle() {
    // Refusals (no user gesture, a policy) leave the page as it is.
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
    else await document.documentElement.requestFullscreen().catch(() => {})
  }
  return { supported, active, toggle }
}
