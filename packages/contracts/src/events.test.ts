import { describe, expect, it } from 'vitest'
import { Event, SyncBody } from './index.ts'

const hash = 'a'.repeat(64)
const sealed = { seq: 1, at: 1_700_000_000_000, prevHash: hash, hash, mac: hash }

describe('Event schema', () => {
  it('accepts a valid answer event', () => {
    const parsed = Event.parse({ ...sealed, type: 'answer', data: { questionId: 'q1', value: ['a', 'b'] } })
    expect(parsed.type).toBe('answer')
  })

  it('rejects unknown event types', () => {
    expect(Event.safeParse({ ...sealed, type: 'hack', data: {} }).success).toBe(false)
  })

  it('rejects extra fields on empty payloads', () => {
    expect(Event.safeParse({ ...sealed, type: 'session.started', data: { x: 1 } }).success).toBe(false)
  })

  it('rejects unknown keys instead of stripping them (hashes cover the raw payload)', () => {
    const result = Event.safeParse({
      ...sealed,
      type: 'answer',
      data: { questionId: 'q1', value: 'x', extra: 1 },
    })
    expect(result.success).toBe(false)
  })

  it('rejects a fragment that ends before it starts', () => {
    const data = { reason: 'risk', tStart: 10, tEnd: 5, chunks: [hash] }
    expect(Event.safeParse({ ...sealed, type: 'evidence.fragment', data }).success).toBe(false)
  })

  it('rejects text that would poison storage or hashing', () => {
    for (const value of ['nul\u0000', 'lone \ud800']) {
      expect(Event.safeParse({ ...sealed, type: 'answer', data: { questionId: 'q1', value } }).success).toBe(
        false,
      )
    }
  })

  it('limits a sync batch to 100 events', () => {
    const events = Array.from({ length: 101 }, (_, i) => ({
      ...sealed,
      seq: i + 1,
      type: 'session.started',
      data: {},
    }))
    expect(SyncBody.safeParse({ events }).success).toBe(false)
  })
})
