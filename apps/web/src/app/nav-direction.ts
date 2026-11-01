import type { Router } from 'vue-router'
import { sectionOf, TABS } from './shell/sections'

const tabOf = (path: string) => {
  const section = sectionOf(path)
  return section ? TABS.indexOf(section) : -1
}
const depth = (path: string) => path.split('/').filter(Boolean).length

export type NavDirection = 'forward' | 'back' | 'tab-forward' | 'tab-back'

/**
 * Which way a navigation goes, for the page's slide on phones (motion.css), like a native app:
 * going back in history or up a level slides from the left, deeper from the right; to another tab (also
 * from deep inside the current one) by their order. `wentBack`: the browser's history moved back (the
 * system back gesture, the back button).
 */
export function navDirection(to: string, from: string, wentBack: boolean): NavDirection {
  const [a, b] = [tabOf(from), tabOf(to)]
  if (a >= 0 && b >= 0 && a !== b && depth(to) === 1) return b > a ? 'tab-forward' : 'tab-back'
  if (wentBack || depth(to) < depth(from)) return 'back'
  return 'forward'
}

type Position = { position?: number } | null

/**
 * Marks <html data-nav> on every navigation; the new page's entrance reads it. The router has already
 * written the new history entry (or the browser has, for back/forward) when afterEach runs. The first
 * page just rises in; a navigation that did not happen (cancelled, duplicated) changes nothing, so the
 * position stays the one of the page on screen.
 */
export function trackNavDirection(router: Router) {
  const read = () => (history.state as Position)?.position
  let position = read() ?? 0
  router.afterEach((to, from, failure) => {
    if (failure) return
    const now = read() ?? position
    if (from.matched.length === 0) delete document.documentElement.dataset.nav
    else document.documentElement.dataset.nav = navDirection(to.path, from.path, now < position)
    position = now
  })
}
