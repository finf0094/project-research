import type { RouteRecordRaw } from 'vue-router'

const editor = () => import('./pages/ExamEditorPage.vue')

export const authoringRoutes: RouteRecordRaw[] = [
  { path: '/examiner/exams/new', component: editor, meta: { role: 'examiner', shell: 'staff' } },
  { path: '/examiner/exams/:examId/edit', component: editor, meta: { role: 'examiner', shell: 'staff' } },
]
