import type { ExamMode } from '@exam/contracts'
import type { RouteRecordRaw } from 'vue-router'

/** Where a running attempt is taken: an oral exam is a live call, a written one a question sheet. */
export const attemptPath = (attemptId: string, mode: ExamMode) =>
  mode === 'oral' ? `/attempts/${attemptId}/oral` : `/attempts/${attemptId}`

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
  },
  {
    path: '/attempts/:attemptId/oral',
    component: () => import('./pages/OralExamPage.vue'),
    meta: { role: 'student' },
  },
  {
    path: '/attempts/:attemptId/done',
    component: () => import('./pages/DonePage.vue'),
    meta: { role: 'student' },
  },
]
