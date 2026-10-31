import { describe, expect, it } from 'vitest'
import { errorKey } from './error-key'
import { ApiError } from './http'

describe('errorKey', () => {
  it('turns failures into message keys instead of raw texts', () => {
    expect(errorKey(new TypeError('Failed to fetch'))).toBe('common.error.offline')
    expect(errorKey(new ApiError(409, 'Exam is not open'))).toBe('common.error.conflict')
    expect(errorKey(new ApiError(503, 'Oral exams are not configured'))).toBe('common.error.unavailable')
    expect(errorKey(new ApiError(500, 'Internal server error'))).toBe('common.error.unavailable')
    expect(errorKey(new ApiError(409, 'Exam is not open'), { 409: 'exam.preflight.notOpen' })).toBe(
      'exam.preflight.notOpen',
    )
  })
})
