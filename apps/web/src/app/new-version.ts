import type { Router } from 'vue-router'

/**
 * A new version (the service worker updates in the background after a deploy) is put to use on the next
 * move to an ordinary page, by loading that page afresh. Not at once: a teacher may be half-way through an
 * exam's settings or a grade, and the old version's lazy pages may be gone from the server. Exam pages
 * (no shell) keep the version they started with until the student leaves them. Not on the first visit:
 * then the worker takes control without anything to switch from.
 */
export function useNewVersionOnNextPage(router: Router, worker = navigator.serviceWorker) {
  if (!worker?.controller) return
  let updated = false
  worker.addEventListener('controllerchange', () => (updated = true))
  router.beforeEach((to) => {
    if (!updated || !to.meta.shell) return
    location.assign(to.fullPath)
    return false
  })
}
