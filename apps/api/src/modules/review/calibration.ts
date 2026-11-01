import type { CalibrationRow, MarkerKind } from '@exam/contracts'
import { and, count, eq, inArray } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { attempts, exams, markers } from '../../db/schema.ts'

/** Below this many decisions a kind keeps its usual weight: a few judgements say little. */
export const MIN_DECISIONS = 5

/**
 * Section 25.4: the examiner's confirmations and dismissals as a weight factor per marker kind. The share
 * confirmed (smoothed towards one half) times two: a kind confirmed as often as dismissed keeps its weight,
 * a noisy kind (mostly dismissed) counts less in the review priority, a reliable one more (0.25…2).
 */
export function calibrationFactor(confirmed: number, dismissed: number): number {
  if (confirmed + dismissed < MIN_DECISIONS) return 1
  const precision = (confirmed + 1) / (confirmed + dismissed + 2)
  return Math.min(2, Math.max(0.25, Math.round(precision * 2 * 100) / 100))
}

/** Decisions on markers across the examiner's exams, by kind. */
export async function calibration(db: Db | Tx, ownerId: string): Promise<CalibrationRow[]> {
  const rows = await db
    .select({ kind: markers.kind, status: markers.status, n: count() })
    .from(markers)
    .innerJoin(attempts, eq(attempts.id, markers.attemptId))
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(exams.ownerId, ownerId), inArray(markers.status, ['confirmed', 'dismissed'])))
    .groupBy(markers.kind, markers.status)
  const byKind = new Map<MarkerKind, { confirmed: number; dismissed: number }>()
  for (const { kind, status, n } of rows) {
    const entry = byKind.get(kind) ?? { confirmed: 0, dismissed: 0 }
    entry[status as 'confirmed' | 'dismissed'] += n
    byKind.set(kind, entry)
  }
  return [...byKind].map(([kind, c]) => ({ kind, ...c, factor: calibrationFactor(c.confirmed, c.dismissed) }))
}

/** The factors only, for the analysis. */
export async function calibrationFactors(db: Db | Tx, ownerId: string) {
  return Object.fromEntries((await calibration(db, ownerId)).map((r) => [r.kind, r.factor])) as Partial<
    Record<MarkerKind, number>
  >
}
