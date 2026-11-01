import type { AttemptDetail, Marker } from '@exam/contracts'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useAttemptReview } from './use-attempt-review'

const marker = (id: string, status: Marker['status'] = 'pending') =>
  ({ id, kind: 'page_closed', status, discrepancy: false, chunks: [] }) as unknown as Marker
let markers = [marker('a'), marker('b'), marker('c', 'confirmed'), marker('d')]
const judgeMarker = vi.fn(async (id: string, status: Marker['status']) => {
  markers = markers.map((m) => (m.id === id ? { ...m, status } : m))
})
const getAttempt = vi.fn(async () => ({ examId: 'e', summary: { status: 'ready_for_review' }, markers }))
vi.mock('./api', () => ({
  getAttempt: () => getAttempt(),
  judgeMarker: (id: string, status: Marker['status']) => judgeMarker(id, status),
  listAttempts: async () => [],
  decide: vi.fn(),
  chunkUrl: () => '',
}))

describe('useAttemptReview', () => {
  it('judges every pending marker of a kind with the existing API, reloads once and moves the stage on', async () => {
    let review!: ReturnType<typeof useAttemptReview>
    mount(defineComponent({ setup: () => ((review = useAttemptReview('x')), () => null) }))
    await flushPromises()
    expect(review.selected.value).toBe('a')
    getAttempt.mockClear()

    await review.judgeAll(['a', 'b'], 'dismissed')
    expect(judgeMarker.mock.calls).toEqual([
      ['a', 'dismissed'],
      ['b', 'dismissed'],
    ])
    expect(getAttempt).toHaveBeenCalledTimes(1)
    expect((review.detail.value as AttemptDetail).markers.map((m) => m.status)).toEqual([
      'dismissed',
      'dismissed',
      'confirmed',
      'pending',
    ])
    expect(review.selected.value).toBe('d')
  })
})
