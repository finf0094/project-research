import { describe, expect, it } from 'vitest'
import { russianPlural } from './index'

describe('russianPlural', () => {
  it('picks the Russian form for a number', () => {
    const forms = ['минута', 'минуты', 'минут']
    const pick = (n: number) => forms[russianPlural(n, 3)]
    expect([1, 2, 5, 11, 21, 22, 25, 90, 101, 112].map(pick)).toEqual([
      'минута',
      'минуты',
      'минут',
      'минут',
      'минута',
      'минуты',
      'минут',
      'минут',
      'минута',
      'минут',
    ])
  })
})
