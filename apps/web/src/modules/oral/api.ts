import { OralRoomAccess } from '@exam/contracts'
import { request } from '@/shared/lib/http'

/** Access to the live room of an oral attempt (LiveKit URL and a short-lived token). */
export const studentRoomAccess = (attemptId: string) =>
  request(`/attempts/${attemptId}/oral/token`, { method: 'POST' }, OralRoomAccess)

export const examinerRoomAccess = (attemptId: string) =>
  request(`/examiner/attempts/${attemptId}/oral/token`, { method: 'POST' }, OralRoomAccess)
