import type { RouteRecordRaw } from 'vue-router'

export const reviewRoutes: RouteRecordRaw[] = [
  {
    path: '/examiner',
    component: () => import('./pages/ExaminerExamsPage.vue'),
    meta: { role: 'examiner', shell: 'staff' },
  },
  {
    // One exam: a header with its sections; each section is a child route sharing the exam's data.
    path: '/examiner/exams/:examId',
    component: () => import('./pages/ExamHubPage.vue'),
    meta: { role: 'examiner', shell: 'staff' },
    children: [
      { path: '', name: 'hub-overview', component: () => import('./pages/TabOverview.vue') },
      { path: 'monitoring', name: 'hub-monitoring', component: () => import('./pages/TabMonitoring.vue') },
      { path: 'review', name: 'hub-review', component: () => import('./pages/TabReview.vue') },
      { path: 'results', name: 'hub-results', component: () => import('./pages/TabResults.vue') },
    ],
  },
  {
    path: '/calibration',
    component: () => import('./pages/CalibrationPage.vue'),
    meta: { role: 'examiner', shell: 'staff' },
  },
  {
    path: '/examiner/attempts/:attemptId',
    component: () => import('./pages/AttemptReviewPage.vue'),
    meta: { role: 'examiner', shell: 'staff' },
  },
  {
    path: '/examiner/attempts/:attemptId/room',
    component: () => import('./pages/OralRoomPage.vue'),
    meta: { role: 'examiner', shell: 'staff' },
  },
]
