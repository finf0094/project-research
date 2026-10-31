import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { fromLocalInput, toLocalInput, useFields } from './fields'

describe('useFields', () => {
  it('replaces the object instead of mutating it', () => {
    const original = { title: 'a', minutes: 5 }
    const model = ref(original)
    const title = useFields(model)('title')
    title.value = 'b'
    expect(model.value).toEqual({ title: 'b', minutes: 5 })
    expect(original.title).toBe('a')
  })

  it('round-trips local date-time input values', () => {
    const ms = new Date(2026, 10, 2, 9, 30).getTime()
    expect(toLocalInput(ms)).toBe('2026-11-02T09:30')
    expect(fromLocalInput(toLocalInput(ms))).toBe(ms)
  })
})
