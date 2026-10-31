import { describe, expect, it } from 'vitest'
import { ApiError } from './http'
import { useAction } from './use-action'

describe('useAction', () => {
  it('keeps a failure as a message key and clears it on the next run', async () => {
    const action = useAction({ 409: 'review.notRunning' })
    expect(await action.run(() => Promise.reject(new ApiError(409, 'Attempt is not running')))).toBe(false)
    expect(action.error.value).toBe('review.notRunning')
    expect(await action.run(async () => undefined)).toBe(true)
    expect(action.error.value).toBeNull()
    expect(action.busy.value).toBe(false)
  })
})
