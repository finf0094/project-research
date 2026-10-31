import type { RouteRecordRaw } from 'vue-router'

export const reviewRoutes: RouteRecordRaw[] = [
  {
    path: '/examiner',
    component: () => import('./pages/ExaminerExamsPage.vue'),
    meta: { role: 'examiner', shell: true },
  },
  {
    path: '/examiner/exams/:examId',
    component: () => import('./pages/MonitoringPage.vue'),
    meta: { role: 'examiner', shell: true },
  },
  {
    path: '/examiner/attempts/:attemptId',
    component: () => import('./pages/AttemptReviewPage.vue'),
    meta: { role: 'examiner', shell: true },
  },
]
