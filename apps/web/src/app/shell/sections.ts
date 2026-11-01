import { CircleUserRound, FileText, GraduationCap, SlidersHorizontal, Users } from 'lucide-vue-next'
import { computed, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/modules/auth'

export interface Section {
  to: string
  /** Message key of its name. */
  label: string
  icon: Component
}

const PROFILE: Section = { to: '/profile', label: 'app.nav.profile', icon: CircleUserRound }

/**
 * The top-level sections of each role, in tab order: the staff sidebar, the student's top links and the
 * phone's tab bar all show these, so a section is added in one place.
 */
export function useSections() {
  const auth = useAuthStore()
  const route = useRoute()
  const sections = computed<Section[]>(() => {
    if (auth.role === 'student')
      return [
        { to: '/exams', label: 'app.nav.exams', icon: FileText },
        { to: '/results', label: 'app.nav.results', icon: GraduationCap },
        PROFILE,
      ]
    if (auth.role === 'admin') return [{ to: '/admin', label: 'app.nav.users', icon: Users }, PROFILE]
    return [
      { to: '/examiner', label: 'app.nav.exams', icon: FileText },
      { to: '/calibration', label: 'app.nav.calibration', icon: SlidersHorizontal },
      PROFILE,
    ]
  })
  /** A section stays highlighted on its sub-pages (an exam, an attempt, a result). */
  const inSection = (to: string) =>
    route.path === to ||
    route.path.startsWith(`${to}/`) ||
    (to === '/results' && /^\/attempts\/[^/]+\/result$/.test(route.path))
  return { sections, inSection }
}

/** Where a path sits in the tab order (-1 when it is no tab of this role), for the slide direction. */
export function tabIndex(sections: readonly Section[], path: string) {
  return sections.findIndex((s) => path === s.to || path.startsWith(`${s.to}/`))
}
