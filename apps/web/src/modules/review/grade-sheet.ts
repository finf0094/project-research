import type { AttemptSummary } from '@exam/contracts'
import { passed } from './exam-state'

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
  const scores = attempts.flatMap((a) => (a.result?.score != null ? [a.result.score] : []))
  return BANDS.map(([from, to]) => scores.filter((s) => s >= from && s <= to).length)
}

export type Outcome = 'pass' | 'fail' | 'pending'

export const outcome = (a: AttemptSummary): Outcome => {
  const p = passed(a)
  return p === null ? 'pending' : p ? 'pass' : 'fail'
}

/**
 * The grade sheet as CSV for Excel: a BOM so Cyrillic opens correctly, semicolons (Excel's separator in
 * Russian and Kazakh locales), quoted cells. `labels` are the column titles and outcome words in the UI language.
 */
export function gradeSheetCsv(
  attempts: AttemptSummary[],
  labels: { columns: string[]; outcome: Record<Outcome, string> },
): string {
  const cell = (v: string | number | null) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const rows = attempts.map((a) =>
    [a.student.name, `${a.points.auto}/${a.points.max}`, a.result?.score ?? null, labels.outcome[outcome(a)]]
      .map(cell)
      .join(';'),
  )
  return '﻿' + [labels.columns.map(cell).join(';'), ...rows].join('\r\n')
}
