import type { SignalKind } from '@exam/contracts'
import { describe, expect, it, vi } from 'vitest'
import type { EventLog } from '@/modules/offline'
import { createHinter } from './hints'

function setup() {
  let time = 0
  const append = vi.fn(async () => undefined)
  const shown: (SignalKind | null)[] = []
  const hints = createHinter(
    { append } as unknown as EventLog,
    () => time,
    (k) => shown.push(k),
  )
  return { hints, append, shown, advance: (ms: number) => (time += ms) }
}

describe('createHinter', () => {
  it('shows a hint for an active signal and logs it at most once a minute', () => {
    const { hints, append, shown, advance } = setup()
    hints.show(new Set(['face_missing']))
    advance(30_000)
    hints.show(new Set(['face_missing']))
    advance(31_000)
    hints.show(new Set(['face_missing']))
    expect(shown).toEqual(['face_missing', 'face_missing', 'face_missing'])
    expect(append).toHaveBeenCalledTimes(2)
  })

  it('keeps the "stay on the tab" hint a little after the student comes back', () => {
    const { hints, shown, advance } = setup()
    hints.returned()
    hints.show(new Set())
    advance(11_000)
    hints.show(new Set())
    expect(shown).toEqual(['tab_hidden', null])
  })

  it('never shows a hint for signals without one', () => {
    const { hints, shown } = setup()
    hints.show(new Set(['paste']))
    expect(shown).toEqual([null])
  })
})
