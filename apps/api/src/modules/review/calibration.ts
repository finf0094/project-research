import {
  CALIBRATION_MIN_DECISIONS,
  type Calibration,
  type CalibrationRow,
  type MarkerKind,
} from '@exam/contracts'
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db, Tx } from '../../db/client.ts'
import { attempts, decisions, exams, markers } from '../../db/schema.ts'

/**
 * Section 25.4: "the thresholds of noisy kinds are raised". The share of a kind's markers the examiner
 * confirmed (smoothed towards one half), times two, capped at 1: a kind confirmed at least as often as
 * dismissed keeps its weight; a noisy kind counts less in the review priority, down to a quarter.
 */
export function calibrationFactor(confirmed: number, dismissed: number): number {
  if (confirmed + dismissed < CALIBRATION_MIN_DECISIONS) return 1
  const precision = (confirmed + 1) / (confirmed + dismissed + 2)
  return Math.min(1, Math.max(0.25, Math.round(precision * 2 * 100) / 100))
}

/**
 * Markers of the record's integrity (a broken chain, recordings that never came) keep their weight: many
 * dismissed upload gaps must not hide the one real tampering case.
 */
const INTEGRITY: ReadonlySet<MarkerKind> = new Set(['chain_broken', 'missing_fragment'])

/** Decisions on markers across the examiner's exams, by kind. */
export async function kindDecisions(db: Db | Tx, ownerId: string): Promise<CalibrationRow[]> {
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
  return [...byKind].map(([kind, c]) => ({
    kind,
    ...c,
    factor: INTEGRITY.has(kind) ? 1 : calibrationFactor(c.confirmed, c.dismissed),
  }))
}

/** The factors only, for the analysis. */
export async function calibrationFactors(db: Db | Tx, ownerId: string) {
  return Object.fromEntries((await kindDecisions(db, ownerId)).map((r) => [r.kind, r.factor])) as Partial<
    Record<MarkerKind, number>
  >
}

/**
 * The control sample: decided attempts of the examiner's exams that had no markers to judge, and how many
 * of them the latest decision still called a violation — an estimate of what the markers miss.
 */
async function controlSample(db: Db | Tx, ownerId: string) {
  const latest = db
    .selectDistinctOn([decisions.attemptId], { attemptId: decisions.attemptId, verdict: decisions.verdict })
    .from(decisions)
    .orderBy(decisions.attemptId, desc(decisions.seq))
    .as('latest')
  const [row] = await db
    .select({
      unmarked: count(),
      missed: count(sql`case when ${latest.verdict} = 'violation' then 1 end`),
    })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .innerJoin(latest, eq(latest.attemptId, attempts.id))
    .where(
      and(
        eq(exams.ownerId, ownerId),
        eq(attempts.status, 'decided'),
        sql`not exists (select 1 from ${markers} m where m.attempt_id = ${attempts.id} and m.status <> 'context')`,
      ),
    )
  return { unmarked: row?.unmarked ?? 0, missed: row?.missed ?? 0 }
}

export async function calibration(db: Db | Tx, ownerId: string): Promise<Calibration> {
  return { kinds: await kindDecisions(db, ownerId), control: await controlSample(db, ownerId) }
}
