import type { ExamMode } from '@exam/contracts'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { loadAttempt } from './local-attempt'
import { attemptPath } from './paths'

/**
 * Sends an attempt to the page of its mode before any page mounts (a stale link or bookmark may point to
 * the other one). If the attempt cannot be loaded here (offline, never opened), the page shows why.
 */
function pageOf(mode: ExamMode) {
  return async (to: RouteLocationNormalized) => {
    const id = String(to.params.attemptId)
    const actual = await loadAttempt(id).then(
      (a) => a.exam.profile.mode,
      () => mode,
    )
    return actual === mode ? true : attemptPath(id, actual)
  }
}

export const examRoutes: RouteRecordRaw[] = [
  {
    path: '/exams',
    component: () => import('./pages/ExamsPage.vue'),
    meta: { role: 'student', shell: true },
  },
  {
    path: '/exams/:examId/preflight',
    component: () => import('./pages/PreflightPage.vue'),
    meta: { role: 'student' },
  },
  {
    path: '/attempts/:attemptId',
    component: () => import('./pages/ExamPage.vue'),
    meta: { role: 'student' },
    beforeEnter: pageOf('written'),
  },
  {
    path: '/attempts/:attemptId/oral',
    component: () => import('./pages/OralExamPage.vue'),
    meta: { role: 'student' },
    beforeEnter: pageOf('oral'),
  },
  {
    path: '/attempts/:attemptId/done',
    component: () => import('./pages/DonePage.vue'),
    meta: { role: 'student' },
  },
]
