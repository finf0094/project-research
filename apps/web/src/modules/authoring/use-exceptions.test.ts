import type { SignalException } from '@exam/contracts'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { setException } from './api'
import { useExceptions } from './use-exceptions'

vi.mock('./api', () => ({ setException: vi.fn() }))
const save = vi.mocked(setException)

/** A save the test finishes by hand, to order the answers. */
function pending() {
  let settle!: (ok: boolean) => void
  save.mockImplementationOnce(
    () =>
      new Promise<void>((resolve, reject) => (settle = (ok) => (ok ? resolve() : reject(new Error('no'))))),
  )
  return (ok: boolean) => settle(ok)
}

describe('individual exceptions', () => {
  it('rolls back a refused save, and another student’s save does not hide the error', async () => {
    const exceptions = ref<SignalException[]>([])
    const x = useExceptions(ref('exam'), exceptions)
    const finishA = pending()
    const finishB = pending()
    const a = x.toggle('a@x', 'noise', true)
    const b = x.toggle('b@x', 'paste', true)
    expect(x.disabledFor('a@x')).toEqual(['noise']) // shown at once
    finishA(false)
    await a
    finishB(true)
    await b
    expect(x.disabledFor('a@x')).toEqual([])
    expect(x.disabledFor('b@x')).toEqual(['paste'])
    expect([...x.failed.value.keys()]).toEqual(['a@x'])
    expect(x.saving.value.size).toBe(0)
  })

  it('drops an answer about an exam the page has left', async () => {
    const examId = ref<string | null>('one')
    const exceptions = ref<SignalException[]>([])
    const x = useExceptions(examId, exceptions)
    const finish = pending()
    const saving = x.toggle('a@x', 'noise', true)
    examId.value = 'two'
    exceptions.value = [] // the page loads the other exam
    await nextTick()
    finish(false)
    await saving
    expect(exceptions.value).toEqual([])
    expect(x.failed.value.size).toBe(0)
  })

  it('forgets removed students', () => {
    const exceptions = ref<SignalException[]>([{ email: 'a@x', disabledSignals: ['noise'] }])
    const x = useExceptions(ref('exam'), exceptions)
    x.keepOnly(['b@x'])
    expect(exceptions.value).toEqual([])
  })
})
