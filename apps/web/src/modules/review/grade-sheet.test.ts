import type { AttemptSummary } from '@exam/contracts'
import { describe, expect, it } from 'vitest'
import { distribution, gradeSheetCsv } from './grade-sheet'

const attempt = (name: string, result: AttemptSummary['result']) =>
  ({ student: { name }, points: { auto: 6, max: 10, open: false }, result }) as AttemptSummary

const list = [
  attempt('Алия "Ли" С.', { verdict: 'clean', score: 92 }),
  attempt('Борис', { verdict: 'violation', score: 70 }),
  attempt('Вера', null),
]

describe('grade sheet', () => {
  it('counts scores into bands, leaving out what is not scored yet', () => {
    expect(distribution(list)).toEqual([0, 0, 0, 1, 0, 1])
  })

  it('writes CSV that Excel opens with Cyrillic and quotes intact', () => {
    const csv = gradeSheetCsv(list, {
      columns: ['Студент', 'Авто', 'Из', 'Балл', 'Итог'],
      outcome: { pass: 'Зачтено', fail: 'Не зачтено', pending: 'Ждёт' },
    })
    const [head, first, second, third] = csv.slice(1).split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(head).toBe('"Студент";"Авто";"Из";"Балл";"Итог"')
    expect(first).toBe('"Алия ""Ли"" С.";"6";"10";"92";"Зачтено"')
    expect(second).toBe('"Борис";"6";"10";"70";"Не зачтено"') // a confirmed violation fails
    expect(third).toBe('"Вера";"6";"10";"";"Ждёт"')
  })

  it('counts an attempt sent back for more review as pending, not as a result', () => {
    const csv = gradeSheetCsv([attempt('Глеб', { verdict: 'needs_review', score: 90 })], {
      columns: ['a', 'b', 'c', 'd', 'e'],
      outcome: { pass: 'p', fail: 'f', pending: 'w' },
    })
    expect(csv.split('\r\n')[1]).toBe('"Глеб";"6";"10";"";"w"')
    expect(distribution([attempt('Глеб', { verdict: 'needs_review', score: 90 })])).toEqual([
      0, 0, 0, 0, 0, 0,
    ])
  })

  it('defuses names a spreadsheet would run as formulas, and uses the separator asked for', () => {
    const csv = gradeSheetCsv(
      [attempt('=HYPERLINK("x")', null)],
      {
        columns: ['a', 'b', 'c', 'd', 'e'],
        outcome: { pass: 'p', fail: 'f', pending: 'w' },
      },
      ',',
    )
    expect(csv.split('\r\n')[1]).toBe('"\'=HYPERLINK(""x"")","6","10","","w"')
  })
})
