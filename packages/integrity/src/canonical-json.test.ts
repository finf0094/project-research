import { describe, expect, it } from 'vitest'
import { canonicalize } from './canonical-json.ts'

describe('canonicalize', () => {
  it('does not depend on key order', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }))
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}')
  })

  it('sorts nested objects and keeps array order', () => {
    expect(canonicalize({ z: [3, { y: 1, x: 2 }], a: null })).toBe('{"a":null,"z":[3,{"x":2,"y":1}]}')
  })

  it('drops undefined properties like JSON.stringify', () => {
    expect(canonicalize({ a: undefined, b: 'x' })).toBe('{"b":"x"}')
  })

  it('serializes unicode strings as JSON does', () => {
    expect(canonicalize({ text: 'Сәлем "мир"' })).toBe('{"text":"Сәлем \\"мир\\""}')
  })

  it('rejects non-finite numbers', () => {
    expect(() => canonicalize({ n: Number.NaN })).toThrow(TypeError)
  })
})

describe('canonicalize rejects values JSON would change silently', () => {
  it('rejects class instances and dates', () => {
    expect(() => canonicalize({ d: new Date(0) })).toThrow(TypeError)
    expect(() => canonicalize(new Map())).toThrow(TypeError)
  })

  it('rejects sparse arrays', () => {
    // eslint-disable-next-line no-sparse-arrays
    expect(() => canonicalize([, 1])).toThrow(TypeError)
  })

  it('rejects lone surrogates', () => {
    expect(() => canonicalize('\ud800')).toThrow(TypeError)
  })

  it('accepts null-prototype objects', () => {
    const o = Object.assign(Object.create(null), { b: 1, a: 2 })
    expect(canonicalize(o)).toBe('{"a":2,"b":1}')
  })
})
