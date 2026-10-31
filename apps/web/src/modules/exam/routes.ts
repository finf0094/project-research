import type { RouteRecordRaw } from 'vue-router'

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
    path: '/attempts/:attemptId/done',
    component: () => import('./pages/DonePage.vue'),
    meta: { role: 'student' },
  },
]
