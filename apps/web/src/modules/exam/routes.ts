import type { ExamMode } from '@exam/contracts'
import type { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import { getAttempt } from '@/modules/offline'
import { attemptPath } from './paths'

/**
 * Sends an attempt to the page of its mode before any page mounts (a stale link or bookmark may point to
 * the other one). Only the local copy is asked, so navigation never waits for the network; an attempt
 * this device has not seen yet is redirected by the page once it is loaded.
 */
function pageOf(mode: ExamMode) {
  return async (to: RouteLocationNormalized) => {
    const actual = (await getAttempt(String(to.params.attemptId)).catch(() => undefined))?.exam.profile.mode
    return !actual || actual === mode
      ? true
      : { path: attemptPath(String(to.params.attemptId), actual), query: to.query, hash: to.hash }
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
