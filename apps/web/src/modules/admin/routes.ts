import type { RouteRecordRaw } from 'vue-router'

export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/admin',
    component: () => import('./pages/UsersPage.vue'),
    meta: { role: 'admin', shell: 'staff' },
  },
]
