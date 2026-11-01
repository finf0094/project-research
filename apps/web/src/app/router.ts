import type { Role } from '@exam/contracts'
import { createRouter, createWebHistory } from 'vue-router'
import { adminRoutes } from '@/modules/admin'
import { authRoutes, useAuthStore } from '@/modules/auth'
import { authoringRoutes } from '@/modules/authoring'
import { examRoutes } from '@/modules/exam'
import { reviewRoutes } from '@/modules/review'
import { homeFor } from './shell/sections'

declare module 'vue-router' {
  interface RouteMeta {
    /** Pages anyone can open (sign-in). */
    public?: boolean
    /** Only this role may open the page. */
    role?: Role
    /**
     * The frame around the page: the student's top bar or the staff sidebar; `auto` picks by the role
     * (pages everyone has, like the profile); none for full-screen pages.
     */
    shell?: 'student' | 'staff' | 'auto'
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
    { path: '/profile', component: () => import('./ProfilePage.vue'), meta: { shell: 'auto' } },
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
