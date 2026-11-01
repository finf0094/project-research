import { describe, expect, it } from 'vitest'
import {
  formatStartCode,
  newStartCode,
  normalizeStartCode,
  openPackage,
  sealPackage,
} from './exam-package.ts'

describe('exam package', () => {
  it('opens with the right code (as typed by a person) and never with a wrong one or for another exam', async () => {
    const code = newStartCode()
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/)
    const sealed = await sealPackage('{"questions":[]}', code, 'exam-1', 1000)
    const typed = ` ${formatStartCode(code).toLowerCase()} `
    expect(await openPackage(sealed, typed, 'exam-1', 1000)).toBe('{"questions":[]}')
    await expect(openPackage(sealed, newStartCode(), 'exam-1', 1000)).rejects.toThrow()
    await expect(openPackage(sealed, code, 'exam-2', 1000)).rejects.toThrow()
  })

  it('reads easily confused letters as the digits they stand for', () => {
    expect(normalizeStartCode('ol-i 2')).toBe('0112')
  })
})
