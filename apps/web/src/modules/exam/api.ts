import { AttemptSession, AttemptStatus, StudentExamListItem, type SubmitBody } from '@exam/contracts'
import { z } from 'zod'
import { request } from '@/shared/lib/http'

export const listExams = () => request('/exams', {}, z.array(StudentExamListItem))

export const startAttempt = (examId: string) =>
  request('/attempts', { method: 'POST', body: { examId } }, AttemptSession)

export const fetchAttempt = (attemptId: string) => request(`/attempts/${attemptId}`, {}, AttemptSession)

export const submitAttempt = (attemptId: string, body: SubmitBody) =>
  request(`/attempts/${attemptId}/submit`, { method: 'POST', body }, z.object({ status: AttemptStatus }))
