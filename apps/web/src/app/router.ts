import type { Role } from '@exam/contracts'
import { createRouter, createWebHistory } from 'vue-router'
import { adminRoutes } from '@/modules/admin'
import { authRoutes, homeFor, useAuthStore } from '@/modules/auth'
import { authoringRoutes } from '@/modules/authoring'
import { examRoutes } from '@/modules/exam'
import { reviewRoutes } from '@/modules/review'

declare module 'vue-router' {
  interface RouteMeta {
    /** Pages anyone can open (sign-in). */
    public?: boolean
    /** Only this role may open the page. */
    role?: Role
    /** The frame around the page: the student's top bar or the staff sidebar; none for full-screen pages. */
    shell?: 'student' | 'staff'
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    ...authRoutes,
    ...examRoutes,
    ...reviewRoutes,
    ...authoringRoutes,
    ...adminRoutes,
    { path: '/', redirect: () => homeFor(useAuthStore().role) },
    { path: '/:pathMatch(.*)*', component: () => import('./NotFoundPage.vue'), meta: { public: true } },
  ],
})

router.beforeEach((to) => {
  if (to.meta.public) return true
  const auth = useAuthStore()
  if (!auth.user) return { path: '/login', query: { next: to.fullPath } }
  if (to.meta.role && to.meta.role !== auth.role) return homeFor(auth.role)
  return true
})
