import { afterEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from './http'

describe('withTimeout on Safari before 17.4 (no AbortSignal.any / timeout)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function withoutModernSignals() {
    Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true })
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true })
  }

  it('times out as a TimeoutError, so the request reads as a network failure', () => {
    const any = AbortSignal.any
    const timeout = AbortSignal.timeout
    vi.useFakeTimers()
    try {
      withoutModernSignals()
      const signal = withTimeout(1000, new AbortController().signal)
      expect(signal.aborted).toBe(false)
      vi.advanceTimersByTime(1000)
      expect(signal.aborted).toBe(true)
      expect((signal.reason as DOMException).name).toBe('TimeoutError')
    } finally {
      Object.defineProperty(AbortSignal, 'any', { value: any, configurable: true })
      Object.defineProperty(AbortSignal, 'timeout', { value: timeout, configurable: true })
    }
  })

  it("follows the caller's signal", () => {
    const any = AbortSignal.any
    try {
      Object.defineProperty(AbortSignal, 'any', { value: undefined, configurable: true })
      const caller = new AbortController()
      const signal = withTimeout(60_000, caller.signal)
      caller.abort()
      expect(signal.aborted).toBe(true)
    } finally {
      Object.defineProperty(AbortSignal, 'any', { value: any, configurable: true })
    }
  })
})
