import type { AttemptSummary } from '@exam/contracts'
import { finalScore, passed } from './exam-state'

/** Score bands of the distribution chart (percent). */
export const BANDS = [
  [0, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 89],
  [90, 100],
] as const

/** How many scored attempts fall into each band. */
export function distribution(attempts: AttemptSummary[]): number[] {
  const scores = attempts.map(finalScore).filter((s) => s !== null)
  return BANDS.map(([from, to]) => scores.filter((s) => s >= from && s <= to).length)
}

export type Outcome = 'pass' | 'fail' | 'pending'

export const outcome = (a: AttemptSummary): Outcome => {
  const p = passed(a)
  return p === null ? 'pending' : p ? 'pass' : 'fail'
}

/** Where a student is on the grade sheet: still writing is not "awaiting review", the result filters say. */
export type SheetStatus = Outcome | 'writing'

export const sheetStatus = (a: AttemptSummary): SheetStatus =>
  a.status === 'active' ? 'writing' : outcome(a)

/** Text that a spreadsheet would run as a formula gets a leading apostrophe (CSV injection). */
const FORMULA = /^[=+\-@\t\r]/

/**
 * The grade sheet as CSV for Excel: a BOM so Cyrillic opens correctly, quoted cells, and the separator
 * Excel expects in the UI language (a semicolon where the decimal mark is a comma, as in Russian and
 * Kazakh). `labels` are the column titles (student, auto, max, score, result) and outcome words.
 */
export function gradeSheetCsv(
  attempts: AttemptSummary[],
  labels: { columns: string[]; outcome: Record<Outcome, string> },
  separator: ';' | ',' = ';',
): string {
  const cell = (v: string | number | null) => {
    const text = String(v ?? '')
    const safe = typeof v === 'string' && FORMULA.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  const row = (cells: (string | number | null)[]) => cells.map(cell).join(separator)
  const rows = attempts.map((a) =>
    row([
      a.student.name,
      a.points?.auto ?? null,
      a.points?.max ?? null,
      finalScore(a),
      labels.outcome[outcome(a)],
    ]),
  )
  return '\ufeff' + [row(labels.columns), ...rows].join('\r\n')
}
