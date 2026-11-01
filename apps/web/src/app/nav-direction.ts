import type { RouteLocationNormalized, Router } from 'vue-router'

/** Every role's tabs in one order (each role's own tabs keep their relative order in it). */
const TABS = ['/exams', '/results', '/examiner', '/calibration', '/admin', '/profile']
const tabOf = (path: string) => TABS.findIndex((t) => path === t || path.startsWith(`${t}/`))
const depth = (path: string) => path.split('/').filter(Boolean).length

export type NavDirection = 'forward' | 'back' | 'tab-forward' | 'tab-back'

/**
 * Which way a navigation goes, for the page's slide on phones (motion.css), like a native app:
 * going back in history or up a level slides from the left, deeper from the right; between tabs by
 * their order. `wentBack`: the browser's history moved back (the system back gesture, the back button).
 */
export function navDirection(to: string, from: string, wentBack: boolean): NavDirection {
  const [a, b] = [tabOf(from), tabOf(to)]
  if (a >= 0 && b >= 0 && a !== b && depth(to) === 1 && depth(from) === 1)
    return b > a ? 'tab-forward' : 'tab-back'
  if (wentBack || depth(to) < depth(from)) return 'back'
  return 'forward'
}

/** Marks <html data-nav> on every navigation; the new page's entrance reads it. */
export function trackNavDirection(router: Router) {
  let position = (history.state as { position?: number } | null)?.position ?? 0
  router.afterEach((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
    const now = (history.state as { position?: number } | null)?.position ?? position
    document.documentElement.dataset.nav = navDirection(to.path, from.path, now < position)
    position = now
  })
}
