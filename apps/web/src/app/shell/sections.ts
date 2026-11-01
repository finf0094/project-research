import type { Role } from '@exam/contracts'
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
 * phone's tab bar all show these, so a section is added in one place. Signed out: none.
 */
export function sectionsFor(role: Role | null): Section[] {
  if (role === 'student')
    return [
      { to: '/exams', label: 'app.nav.exams', icon: FileText },
      { to: '/results', label: 'app.nav.results', icon: GraduationCap },
      PROFILE,
    ]
  if (role === 'admin') return [{ to: '/admin', label: 'app.nav.users', icon: Users }, PROFILE]
  if (role === 'examiner')
    return [
      { to: '/examiner', label: 'app.nav.exams', icon: FileText },
      { to: '/calibration', label: 'app.nav.calibration', icon: SlidersHorizontal },
      PROFILE,
    ]
  return []
}

/** Every role's tabs in one order, derived from the roles' own lists (profile last, as in each of them). */
export const TABS = [
  ...new Set(
    (['student', 'examiner', 'admin'] as const).flatMap((r) =>
      sectionsFor(r)
        .filter((s) => s !== PROFILE)
        .map((s) => s.to),
    ),
  ),
  PROFILE.to,
]

/** Where a role lands after signing in: its first section (the one place a role's home is defined). */
export const homeFor = (role: Role | null) => sectionsFor(role)[0]?.to ?? '/login'

/**
 * The tab a page belongs to (null: none): its own prefix, and a student's result page belongs to
 * Results, not to the exam it came from.
 */
export function sectionOf(path: string): string | null {
  if (/^\/attempts\/[^/]+\/result\/?$/.test(path)) return '/results'
  return TABS.find((t) => path === t || path.startsWith(`${t}/`)) ?? null
}

export function useSections() {
  const auth = useAuthStore()
  const route = useRoute()
  const sections = computed(() => sectionsFor(auth.role))
  /** A section stays highlighted on its sub-pages (an exam, an attempt, a result). */
  const inSection = (to: string) => sectionOf(route.path) === to
  /** `page` on the section itself; on its sub-pages the link is only part of the current location. */
  const current = (to: string) => (route.path === to ? 'page' : inSection(to) ? 'true' : undefined)
  return { sections, inSection, current }
}
