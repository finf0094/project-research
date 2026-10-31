import { AuthoredExam, ParticipantsResult, type ExamDefinition } from '@exam/contracts'
import { z } from 'zod'
import { request } from '@/shared/lib/http'

export const getExam = (examId: string) => request(`/examiner/exams/${examId}/definition`, {}, AuthoredExam)

export const createExam = (definition: ExamDefinition) =>
  request('/examiner/exams', { method: 'POST', body: definition }, z.object({ id: z.string() }))

export const updateExam = (examId: string, definition: ExamDefinition) =>
  request(`/examiner/exams/${examId}/definition`, { method: 'PUT', body: definition })

export const setParticipants = (examId: string, emails: string[]) =>
  request(`/examiner/exams/${examId}/participants`, { method: 'PUT', body: { emails } }, ParticipantsResult)
