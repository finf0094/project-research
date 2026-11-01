import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useFields } from './fields'

describe('useFields', () => {
  it('replaces the object instead of mutating it', () => {
    const original = { title: 'a', minutes: 5 }
    const model = ref(original)
    const title = useFields(model)('title')
    title.value = 'b'
    expect(model.value).toEqual({ title: 'b', minutes: 5 })
    expect(original.title).toBe('a')
  })
})
