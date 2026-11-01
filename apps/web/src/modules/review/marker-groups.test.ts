import type { Marker } from '@exam/contracts'
import { describe, expect, it, vi } from 'vitest'
import { groupMarkers, judgeEach } from './marker-groups'

const marker = (
  id: string,
  kind: Marker['kind'],
  status: Marker['status'] = 'pending',
  discrepancy = false,
) => ({ id, kind, status, discrepancy }) as Marker

describe('marker groups', () => {
  it('groups markers of a kind in the order kinds first happened, with what is still pending', () => {
    const groups = groupMarkers([
      marker('a', 'page_closed'),
      marker('b', 'face_missing', 'confirmed'),
      marker('c', 'page_closed', 'dismissed'),
      marker('d', 'page_closed'),
      marker('e', 'face_missing', 'pending', true),
    ])
    expect(groups.map((g) => g.kind)).toEqual(['page_closed', 'face_missing'])
    expect(groups[0]!.markers.map((m) => m.id)).toEqual(['a', 'c', 'd'])
    expect(groups[0]!.pending).toEqual(['a', 'd'])
    expect(groups[0]!.important).toBe(false)
    expect(groups[1]!.pending).toEqual(['e'])
    expect(groups[1]!.important).toBe(true)
  })

  it('leaves context markers out of what is pending', () => {
    expect(groupMarkers([marker('a', 'offline', 'context')])[0]!.pending).toEqual([])
  })

  it('judges each marker in turn and stops at the first failure', async () => {
    const judge = vi.fn(async (id: string) => {
      if (id === 'b') throw new Error('offline')
    })
    await expect(judgeEach(['a', 'b', 'c'], 'dismissed', judge)).rejects.toThrow('offline')
    expect(judge.mock.calls).toEqual([
      ['a', 'dismissed'],
      ['b', 'dismissed'],
    ])
  })
})
