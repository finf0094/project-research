import type { MarkerKind } from '@exam/contracts'
import { asc, eq, sql } from 'drizzle-orm'
import { attempts, chunkObservations, events, exams, markers } from '../db/schema.ts'
import type { Deps } from '../deps.ts'
import { loadModels, observeChunk } from '../ml/recordings.ts'
import { toIntervals } from '../ml/observations.ts'
import { markLiveDue } from '../modules/attempts/live-due.ts'
import { disabledSignalsOf } from '../modules/exams/exceptions.ts'
import { calibrationFactors } from '../modules/review/calibration.ts'
import { buildMarkers, riskScore } from './analysis.ts'
import { fragmentsOf, uploadedOf } from './attempt-data.ts'

/** A burst of signals settles this long before the markers are rebuilt (one rebuild, not one per event). */
const SETTLE_MS = 2000
/** New chunks looked at per run, so one busy attempt cannot hold the worker; the rest come next run. */
const CHUNKS_PER_RUN = 6

/**
 * Markers while the exam is still running: when a student's device reports a signal or uploads a
 * recording, the worker rebuilds that attempt's markers from its log and runs the server's models on the
 * new chunks, so the examiner sees them during the exam, not only after it. The analysis after the exam
 * replaces them with the final ones. False when no attempt is due.
 */
export async function analyzeLiveNext(deps: Deps): Promise<boolean> {
  const due = new Date(deps.now() - SETTLE_MS)
  // Claimed by clearing the mark: a signal arriving meanwhile sets it again, and the next run sees it.
  const [attempt] = await deps.db
    .update(attempts)
    .set({ liveDueAt: null })
    .where(
      eq(
        attempts.id,
        sql`(select id from ${attempts} where ${attempts.status} = 'active' and ${attempts.liveDueAt} <= ${due.toISOString()}::timestamptz
          order by ${attempts.liveDueAt} limit 1 for update skip locked)`,
      ),
    )
    .returning()
  if (!attempt) return false
  try {
    await rebuild(deps, attempt)
  } catch (error) {
    console.error(`live analysis of attempt ${attempt.id} failed`, error)
  }
  return true
}

async function rebuild(deps: Deps, attempt: typeof attempts.$inferSelect) {
  const { db } = deps
  const fragments = await fragmentsOf(db, attempt.id)
  const uploaded = await uploadedOf(db, attempt.id)
  const findings = toIntervals((await observeNewChunks(deps, attempt.id, fragments, uploaded)).flat())
  const log = await db
    .select({ seq: events.seq, type: events.type, data: events.data, clientAt: events.clientAt })
    .from(events)
    .where(eq(events.attemptId, attempt.id))
    .orderBy(asc(events.seq))
  const drafts = buildMarkers(log, {
    endAt: deps.now(),
    uploaded,
    chainBrokenAt: attempt.chainBrokenAt,
    serverFindings: findings,
    live: true,
  })
  const disabled = new Set<MarkerKind>(await disabledSignalsOf(db, attempt.examId, attempt.userId))
  const kept = drafts.filter((m) => !disabled.has(m.kind))
  const [exam] = await db.select({ ownerId: exams.ownerId }).from(exams).where(eq(exams.id, attempt.examId))
  const calibration = exam ? await calibrationFactors(db, exam.ownerId).catch(() => ({})) : {}

  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(attempts).where(eq(attempts.id, attempt.id)).for('update')
    if (current?.status !== 'active') return // finished meanwhile: the final analysis takes over
    await tx.delete(markers).where(eq(markers.attemptId, attempt.id))
    if (kept.length) await tx.insert(markers).values(kept.map((m) => ({ ...m, attemptId: attempt.id })))
    await tx
      .update(attempts)
      .set({ riskScore: riskScore(kept, calibration) })
      .where(eq(attempts.id, attempt.id))
  })
}

/** Every chunk's observations: new uploads are looked at now (a few per run) and kept for later runs. */
async function observeNewChunks(
  deps: Deps,
  attemptId: string,
  fragments: Awaited<ReturnType<typeof fragmentsOf>>,
  uploaded: ReadonlySet<string>,
) {
  const { db, storage } = deps
  const stored = await db
    .select({ hash: chunkObservations.hash, observations: chunkObservations.observations })
    .from(chunkObservations)
    .where(eq(chunkObservations.attemptId, attemptId))
  const known = new Map(stored.map((row) => [row.hash, row.observations]))
  const starts = new Map<string, number>()
  for (const f of fragments) f.chunks.forEach((hash, i) => starts.set(hash, f.chunkStarts[i]!))
  const fresh = [...starts]
    .filter(([hash]) => uploaded.has(hash) && !known.has(hash))
    .slice(0, CHUNKS_PER_RUN)

  const models = fresh.length ? await loadModels() : null
  for (const [hash, start] of models ? fresh : []) {
    const observations = (await observeChunk(models!, storage, attemptId, hash, start)) ?? []
    await db.insert(chunkObservations).values({ attemptId, hash, observations }).onConflictDoNothing()
    known.set(hash, observations)
  }
  // Chunks left for the next run keep the attempt due.
  if (fresh.length === CHUNKS_PER_RUN) await markLiveDue(db, attemptId, deps.now())
  return [...known.values()]
}
