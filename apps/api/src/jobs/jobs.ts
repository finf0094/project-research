import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import type { Tx } from '../db/client.ts'
import { answers, attempts, blobs, decisions, events, markers, sessions } from '../db/schema.ts'
import type { Deps } from '../deps.ts'
import { examQuestions } from '../modules/exams/service.ts'
import { projectAnswers, type AnswerEvent } from '../modules/sync/projection.ts'
import { blobKey } from '../shared/storage.ts'
import { buildMarkers, riskScore } from './analysis.ts'

/** Attempts nobody submitted: once the offline window after the deadline is over, no answer can count anymore. */
export async function closeExpired({ db, config, now }: Deps): Promise<number> {
  const cutoff = new Date(now() - config.OFFLINE_WINDOW_MIN * 60_000)
  const rows = await db
    .update(attempts)
    .set({ status: 'submitted', submittedAt: new Date(now()) })
    .where(and(inArray(attempts.status, ['active', 'terminated']), lt(attempts.deadline, cutoff)))
    .returning({ id: attempts.id })
  return rows.length
}

/**
 * Analyzes one submitted attempt whose fragments have all arrived (or whose upload window is over):
 * rebuilds the final answers, turns the log into markers and scores the risk.
 * SKIP LOCKED lets several workers run side by side. If analysis itself fails, the attempt still goes
 * to review (without a score) so one bad attempt can never block the queue.
 * Returns false when there is nothing to do.
 */
export async function analyzeNext(deps: Deps): Promise<boolean> {
  const { db, config, now } = deps
  const uploadCutoff = new Date(now() - config.UPLOAD_WINDOW_HOURS * 3_600_000)
  // True when every chunk announced in the chain has been uploaded.
  const allChunksUploaded = sql`not exists (
    select 1 from ${events} e
    cross join lateral jsonb_array_elements_text(e.data->'chunks') as chunk(hash)
    where e.attempt_id = ${attempts.id} and e.type = 'evidence.fragment'
      and not exists (select 1 from ${blobs} b where b.attempt_id = e.attempt_id and b.hash = chunk.hash))`

  return db.transaction(async (tx) => {
    const [attempt] = await tx
      .select()
      .from(attempts)
      .where(
        and(eq(attempts.status, 'submitted'), or(lt(attempts.submittedAt, uploadCutoff), allChunksUploaded)),
      )
      .orderBy(asc(attempts.submittedAt))
      .limit(1)
      .for('update', { skipLocked: true })
    if (!attempt) return false

    try {
      await tx.transaction((savepoint) => analyze(deps, savepoint, attempt))
    } catch (error) {
      console.error(`analysis of attempt ${attempt.id} failed; sending it to manual review`, error)
      await tx
        .update(attempts)
        .set({ status: 'ready_for_review', riskScore: null })
        .where(eq(attempts.id, attempt.id))
    }
    return true
  })
}

async function analyze(deps: Deps, tx: Tx, attempt: typeof attempts.$inferSelect) {
  const log = await tx
    .select({
      seq: events.seq,
      type: events.type,
      data: events.data,
      clientAt: events.clientAt,
      receivedAt: events.receivedAt,
    })
    .from(events)
    .where(eq(events.attemptId, attempt.id))
    .orderBy(asc(events.seq))
  const uploaded = await tx.select({ hash: blobs.hash }).from(blobs).where(eq(blobs.attemptId, attempt.id))

  const answerEvents = log
    .filter((e) => e.type === 'answer')
    .map((e): AnswerEvent => ({
      seq: e.seq,
      data: e.data as AnswerEvent['data'],
      clientAt: e.clientAt,
      receivedAt: e.receivedAt.getTime(),
    }))
  const final = projectAnswers(
    answerEvents,
    await examQuestions(tx, attempt.examId),
    attempt.deadline.getTime(),
    deps.config.OFFLINE_WINDOW_MIN * 60_000,
  )
  await tx.delete(answers).where(eq(answers.attemptId, attempt.id))
  if (final.size) {
    await tx
      .insert(answers)
      .values([...final].map(([questionId, a]) => ({ attemptId: attempt.id, questionId, ...a })))
  }

  const drafts = buildMarkers(log, {
    endAt: Math.min(attempt.submittedAt?.getTime() ?? deps.now(), attempt.deadline.getTime()),
    uploaded: new Set(uploaded.map((b) => b.hash)),
    chainBrokenAt: attempt.chainBrokenAt,
  })
  await tx.delete(markers).where(eq(markers.attemptId, attempt.id))
  if (drafts.length) await tx.insert(markers).values(drafts.map((m) => ({ ...m, attemptId: attempt.id })))
  await tx
    .update(attempts)
    .set({ status: 'ready_for_review', riskScore: riskScore(drafts) })
    .where(eq(attempts.id, attempt.id))
}

/** Deletes recordings of decided attempts after the retention period; the event log itself is kept. */
export async function removeExpiredRecordings({ db, storage, config, now }: Deps): Promise<number> {
  const cutoff = new Date(now() - config.RETENTION_DAYS * 86_400_000)
  const rows = await db
    .select({ attemptId: blobs.attemptId, hash: blobs.hash })
    .from(blobs)
    .innerJoin(attempts, eq(attempts.id, blobs.attemptId))
    .where(
      and(
        eq(attempts.status, 'decided'),
        sql`(select max(${decisions.decidedAt}) from ${decisions} where ${decisions.attemptId} = ${attempts.id}) < ${cutoff}`,
      ),
    )
  for (const row of rows) {
    await storage.remove(blobKey(row.attemptId, row.hash))
    await db.delete(blobs).where(and(eq(blobs.attemptId, row.attemptId), eq(blobs.hash, row.hash)))
  }
  return rows.length
}

export async function removeExpiredSessions({ db, now }: Deps): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now())))
    .returning({ id: sessions.id })
  return rows.length
}
