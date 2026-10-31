import type { AttemptSummary } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { queuePlace } from './review-queue'

const a = (id: string, status: AttemptSummary['status']) =>
  ({ id, status, student: { name: id.toUpperCase() } }) as AttemptSummary

const list = [
  a('x', 'ready_for_review'),
  a('d', 'decided'),
  a('y', 'ready_for_review'),
  a('z', 'ready_for_review'),
]

describe('queuePlace', () => {
  it('places a waiting attempt and points to the next one', () => {
    expect(queuePlace(list, 'y')).toEqual({ position: 2, total: 3, next: { id: 'z', name: 'Z' } })
    expect(queuePlace(list, 'z').next).toEqual({ id: 'x', name: 'X' }) // after the last, the riskiest
    expect(queuePlace([a('x', 'ready_for_review')], 'x').next).toBeNull()
  })

  it('sends a decided attempt on to the riskiest one still waiting', () => {
    expect(queuePlace(list, 'd')).toEqual({ position: null, total: 3, next: { id: 'x', name: 'X' } })
  })
})
