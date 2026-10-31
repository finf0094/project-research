import type { Role } from '@exam/contracts'

/** Where each role lands after signing in. */
export const homeFor = (role: Role | null) =>
  role === 'examiner' ? '/examiner' : role === 'student' ? '/exams' : '/login'
