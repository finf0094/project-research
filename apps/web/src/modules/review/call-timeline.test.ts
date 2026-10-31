import type { CallEvent } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { studentSpans } from './call-timeline'

const e = (who: CallEvent['who'], kind: CallEvent['kind'], at: number): CallEvent => ({ who, kind, at })

describe('studentSpans', () => {
  it('turns joins and leaves into time on the call and drops', () => {
    const events = [
      e('student', 'joined', 0),
      e('examiner', 'joined', 5),
      e('student', 'left', 100),
      e('student', 'joined', 160),
      e('examiner', 'left', 300),
    ]
    expect(studentSpans(events, 400)).toEqual([
      { kind: 'on', from: 0, to: 100 },
      { kind: 'off', from: 100, to: 160 },
      { kind: 'on', from: 160, to: 400 },
    ])
  })

  it('ignores a repeated join and ends a call that ended with a leave', () => {
    const events = [e('student', 'joined', 0), e('student', 'joined', 10), e('student', 'left', 50)]
    expect(studentSpans(events, 400)).toEqual([{ kind: 'on', from: 0, to: 50 }])
  })
})
