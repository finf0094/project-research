import { and, asc, eq, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { MarkerKind, ServerAnalysis } from '@exam/contracts'
import type { Db, Tx } from '../db/client.ts'
import { answers, attempts, blobs, commands, events, exams, markers } from '../db/schema.ts'
import type { Deps } from '../deps.ts'
import { disabledSignalsOf } from '../modules/exams/exceptions.ts'
import { attemptQuestions } from '../modules/exams/service.ts'
import { calibrationFactors } from '../modules/review/calibration.ts'
import { projectAnswers, type AnswerEvent } from '../modules/sync/projection.ts'
import { analyzeRecordings, type Fragment, type RecordingsReport } from '../ml/recordings.ts'
import { buildMarkers, riskScore } from './analysis.ts'

/** A claim older than this belongs to a worker that died; another worker may take the attempt. */
const CLAIM_LEASE_MS = 15 * 60_000

/**
 * Analyzes one submitted attempt whose fragments have all arrived (or whose upload window is over):
 * rebuilds the final answers, turns the log into markers and scores the risk.
 * Three short steps, so the slow part never holds a lock: claim the attempt (SKIP LOCKED lets several
 * workers run side by side), run the server's models on its recordings without a transaction, then write
 * the results under the row lock. If analysis fails, the attempt still goes to review (without a score),
 * so one bad attempt can never block the queue. Returns false when there is nothing to do.
 */
export async function analyzeNext(deps: Deps): Promise<boolean> {
  const attempt = await claimNext(deps)
  if (!attempt) return false
  try {
    const report = await analyzeRecordings(
      deps.storage,
      attempt.id,
      await fragmentsOf(deps.db, attempt.id),
      await uploadedOf(deps.db, attempt.id),
      // Keeps the claim alive while a long recording is analyzed, so no second worker takes it.
      () => renewClaim(deps, attempt.id),
    )
    const calibration = await calibrationOf(deps, attempt.examId)
    await deps.db.transaction(async (tx) => {
      const [current] = await tx.select().from(attempts).where(eq(attempts.id, attempt.id)).for('update')
      if (current?.status !== 'submitted') return
      try {
        await tx.transaction((savepoint) => analyze(deps, savepoint, current, report, calibration))
      } catch (error) {
        console.error(`analysis of attempt ${attempt.id} failed; sending it to manual review`, error)
        await tx
          .update(attempts)
          .set({ status: 'ready_for_review', riskScore: null, serverAnalysis: report.status })
          .where(eq(attempts.id, attempt.id))
      }
    })
  } catch (error) {
    // Only the database itself can fail here (analysis failures are handled above), so the claim lease
    // retries later; returning true lets the worker go on with the other attempts meanwhile.
    console.error(`could not analyze attempt ${attempt.id}; retrying after the lease`, error)
  }
  return true
}

/**
 * The examiner's past decisions weigh the kinds (section 25.4); read before the row lock, not under it.
 * Calibration only refines the score, so a failed read falls back to neutral factors instead of
 * failing the attempt again on every retry.
 */
async function calibrationOf({ db }: Deps, examId: string): Promise<Partial<Record<MarkerKind, number>>> {
  try {
    const [owner] = await db.select({ id: exams.ownerId }).from(exams).where(eq(exams.id, examId))
    return await calibrationFactors(db, owner!.id)
  } catch (error) {
    console.error(`could not read the calibration for exam ${examId}; scoring without it`, error)
    return {}
  }
}

async function claimNext({ db, config, now }: Deps) {
  const uploadCutoff = new Date(now() - config.UPLOAD_WINDOW_HOURS * 3_600_000)
  const leaseCutoff = new Date(now() - CLAIM_LEASE_MS)
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
        and(
          eq(attempts.status, 'submitted'),
          or(isNull(attempts.analysisClaimedAt), lt(attempts.analysisClaimedAt, leaseCutoff)),
          or(lt(attempts.submittedAt, uploadCutoff), allChunksUploaded),
        ),
      )
      .orderBy(asc(attempts.submittedAt))
      .limit(1)
      .for('update', { skipLocked: true })
    if (!attempt) return null
    await tx
      .update(attempts)
      .set({ analysisClaimedAt: new Date(now()) })
      .where(eq(attempts.id, attempt.id))
    return attempt
  })
}

async function renewClaim({ db, now }: Deps, attemptId: string) {
  await db
    .update(attempts)
    .set({ analysisClaimedAt: new Date(now()) })
    .where(eq(attempts.id, attemptId))
}

/** `partial` when some uploaded chunk was not looked at (undecodable, or uploaded while the models ran). */
function analysisStatus(report: RecordingsReport, uploaded: ReadonlySet<string>): ServerAnalysis {
  if (report.status !== 'ok') return report.status
  return [...uploaded].every((hash) => report.checked.has(hash)) ? 'ok' : 'partial'
}

async function fragmentsOf(db: Db, attemptId: string) {
  const rows = await db
    .select({ data: events.data })
    .from(events)
    .where(and(eq(events.attemptId, attemptId), eq(events.type, 'evidence.fragment')))
  return rows.map((r) => r.data as Fragment)
}

async function uploadedOf(db: Db | Tx, attemptId: string) {
  const rows = await db.select({ hash: blobs.hash }).from(blobs).where(eq(blobs.attemptId, attemptId))
  return new Set(rows.map((b) => b.hash))
}

async function analyze(
  deps: Deps,
  tx: Tx,
  attempt: typeof attempts.$inferSelect,
  recordings: RecordingsReport,
  calibration: Partial<Record<MarkerKind, number>>,
) {
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
    await attemptQuestions(tx, attempt.examId, attempt.ticket),
    attempt.deadline.getTime(),
    deps.config.OFFLINE_WINDOW_MIN * 60_000,
  )
  await tx.delete(answers).where(eq(answers.attemptId, attempt.id))
  if (final.size) {
    await tx
      .insert(answers)
      .values([...final].map(([questionId, a]) => ({ attemptId: attempt.id, questionId, ...a })))
  }

  // Only requests the client acknowledged: an unanswered one means it heard the request and sent nothing.
  const captures = await tx
    .select({ at: commands.createdAt })
    .from(commands)
    .where(
      and(eq(commands.attemptId, attempt.id), eq(commands.type, 'capture'), isNotNull(commands.deliveredAt)),
    )

  // Requests made after the student finished (the sync carrying session.submitted can still schedule one)
  // could never be answered; they must not count against the student.
  const finishedAt = log.find((e) => e.type === 'session.submitted')?.receivedAt.getTime() ?? Infinity

  // Chunks that arrived while the models ran still count as uploaded.
  const uploadedSet = await uploadedOf(tx, attempt.id)

  const drafts = buildMarkers(log, {
    endAt: Math.min(attempt.submittedAt?.getTime() ?? deps.now(), attempt.deadline.getTime()),
    uploaded: uploadedSet,
    chainBrokenAt: attempt.chainBrokenAt,
    captureRequests: captures.map((c) => c.at.getTime()).filter((at) => at < finishedAt),
    serverFindings: recordings.findings,
  })
  // An individual exception (section 25.3): no markers for the signals not watched for this student.
  const disabled = new Set<string>(await disabledSignalsOf(tx, attempt.examId, attempt.userId))
  const kept = drafts.filter((m) => !disabled.has(m.kind))
  await tx.delete(markers).where(eq(markers.attemptId, attempt.id))
  if (kept.length) await tx.insert(markers).values(kept.map((m) => ({ ...m, attemptId: attempt.id })))
  await tx
    .update(attempts)
    .set({
      status: 'ready_for_review',
      riskScore: riskScore(kept, calibration),
      serverAnalysis: analysisStatus(recordings, uploadedSet),
    })
    .where(eq(attempts.id, attempt.id))
}
