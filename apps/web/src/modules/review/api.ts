import {
  AttemptDetail,
  AttemptSummary,
  ExaminerExam,
  type DecisionBody,
  type ExaminerCommandBody,
  type UpdateMarkerBody,
  StartCode,
} from '@exam/contracts'
import { z } from 'zod'
import { request } from '@/shared/lib/http'

export const listExams = () => request('/examiner/exams', {}, z.array(ExaminerExam))

export const getExam = (examId: string) => request(`/examiner/exams/${examId}`, {}, ExaminerExam)

export const publishResults = (examId: string) =>
  request(`/examiner/exams/${examId}/publish`, { method: 'POST' })

export const listAttempts = (examId: string) =>
  request(`/examiner/exams/${examId}/attempts`, {}, z.array(AttemptSummary))

export const getAttempt = (attemptId: string) => request(`/examiner/attempts/${attemptId}`, {}, AttemptDetail)

export const sendCommand = (attemptId: string, body: ExaminerCommandBody) =>
  request(`/examiner/attempts/${attemptId}/commands`, { method: 'POST', body })

export const judgeMarker = (markerId: string, status: UpdateMarkerBody['status']) =>
  request(`/examiner/markers/${markerId}`, { method: 'PATCH', body: { status } })

export const decide = (attemptId: string, body: DecisionBody) =>
  request(`/examiner/attempts/${attemptId}/decision`, { method: 'PUT', body })

export const chunkUrl = (attemptId: string, hash: string) =>
  `/api/examiner/attempts/${attemptId}/chunks/${hash}`

export const getStartCode = (examId: string) => request(`/examiner/exams/${examId}/start-code`, {}, StartCode)
