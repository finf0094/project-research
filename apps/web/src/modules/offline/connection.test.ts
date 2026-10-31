import { describe, expect, it } from 'vitest'
import { initialConnection, nextConnection, retryDelay, type ConnectionState } from './connection'

const fail = (s: ConnectionState) => nextConnection(s, { ok: false })
const ok = (s: ConnectionState, rttMs = 100) => nextConnection(s, { ok: true, rttMs })

describe('nextConnection', () => {
  it('goes slow on the first failure and offline on the third', () => {
    const one = fail(initialConnection)
    expect(one.status).toBe('slow')
    expect(fail(fail(one)).status).toBe('offline')
  })

  it('needs two successes in a row to be online again', () => {
    const offline = fail(fail(fail(initialConnection)))
    const once = ok(offline)
    expect(once.status).toBe('slow')
    expect(ok(once).status).toBe('online')
  })

  it('reports slow on a long round trip', () => {
    expect(ok(initialConnection, 1500).status).toBe('slow')
  })
})

describe('retryDelay', () => {
  it('grows exponentially and is capped at about 30 seconds', () => {
    const mid = () => 0.5
    expect(retryDelay(1, mid)).toBe(1000)
    expect(retryDelay(3, mid)).toBe(4000)
    expect(retryDelay(20, mid)).toBe(30_000)
  })
})
