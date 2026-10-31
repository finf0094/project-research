import type { Role } from '@exam/contracts'

/** Where each role lands after signing in. */
const HOME: Record<Role, string> = { student: '/exams', examiner: '/examiner', admin: '/admin' }

export const homeFor = (role: Role | null) => (role ? HOME[role] : '/login')
