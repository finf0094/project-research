import type { Command, Event, SyncResponse } from '@exam/contracts'
import { importHmacKey, verifyEvent, type ChainHead, type VerifyResult } from '@exam/integrity'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Tx } from '../../db/client.ts'
import { answers, attempts, commands, events, questions } from '../../db/schema.ts'
import type { Deps } from '../../deps.ts'
import { notFound } from '../../shared/errors.ts'
import { OPEN_STATUSES, attemptKey, nextCaptureTime, ownAttempt } from '../attempts/service.ts'
import { attemptQuestions } from '../exams/service.ts'
import { countsTowardGrade, isValidAnswer } from './projection.ts'

const CONTROL_FRAGMENT_SECONDS = 20

/**
 * Accepts a batch of sealed events. Already-accepted events are skipped (retries after a lost ack are safe),
 * a gap stops the batch until the missing events arrive, and a broken link marks the attempt for review.
 * The attempt row is locked, so concurrent requests from one client cannot interleave.
 *
 * `relayedAt`: the events come from a classroom hub (userId null) that received them earlier, at these
 * times (by seq). The hub holds no keys, so it cannot alter an event; its times are believed only between
 * the event's own time and now.
 */
export async function acceptEvents(
  deps: Deps,
  userId: string | null,
  attemptId: string,
  batch: Event[],
  relayedAt?: ReadonlyMap<number, number>,
): Promise<SyncResponse> {
  return deps.db.transaction(async (tx) => {
    const attempt =
      userId === null ? await attemptById(tx, attemptId) : await ownAttempt(tx, userId, attemptId, true)
    const now = deps.now()
    const open = OPEN_STATUSES.includes(attempt.status)
    let head: ChainHead = { seq: attempt.lastSeq, hash: attempt.lastHash }
    let { connection, chainBrokenAt, nextCaptureAt } = attempt

    if (open && chainBrokenAt === null) {
      const key = await importHmacKey(new Uint8Array(attemptKey(deps, attempt)))
      const byId = new Map((await attemptQuestions(tx, attempt.examId, attempt.ticket)).map((q) => [q.id, q]))
      const offlineWindowMs = deps.config.OFFLINE_WINDOW_MIN * 60_000

      for (const event of batch.toSorted((a, b) => a.seq - b.seq)) {
        if (event.seq <= head.seq) continue
        if (event.seq !== head.seq + 1) break
        if (!(await verifies(event, head, key))) {
          chainBrokenAt = event.seq
          break
        }
        const receivedAt = Math.min(now, Math.max(event.at, relayedAt?.get(event.seq) ?? now))
        await tx.insert(events).values({
          attemptId,
          seq: event.seq,
          type: event.type,
          data: event.data,
          clientAt: event.at,
          receivedAt: new Date(receivedAt),
          prevHash: event.prevHash,
          hash: event.hash,
          mac: event.mac,
        })
        await applyEvent(tx, attemptId, event, {
          question: event.type === 'answer' ? byId.get(event.data.questionId) : undefined,
          counts: countsTowardGrade(event.at, receivedAt, attempt.deadline.getTime(), offlineWindowMs),
          now,
        })
        if (event.type === 'network.changed') connection = event.data.to
        // Once the student has finished, proctoring is off: never ask for a fragment that cannot come.
        if (event.type === 'session.submitted') nextCaptureAt = null
        head = { seq: event.seq, hash: event.hash }
      }
    }

    // Updated even when nothing is accepted, so the examiner never sees a connected student as offline.
    await tx
      .update(attempts)
      .set({
        lastSeq: head.seq,
        lastHash: head.hash,
        // A hub's delivery says nothing about whether the student is online now.
        lastSeenAt: relayedAt ? attempt.lastSeenAt : new Date(now),
        relayedByHub: attempt.relayedByHub || (!!relayedAt && head.seq > attempt.lastSeq),
        connection,
        chainBrokenAt,
      })
      .where(eq(attempts.id, attemptId))

    if (attempt.status === 'active' && nextCaptureAt && now >= nextCaptureAt.getTime()) {
      await tx.insert(commands).values({
        attemptId,
        type: 'capture',
        payload: { seconds: CONTROL_FRAGMENT_SECONDS },
        createdAt: new Date(now),
      })
      nextCaptureAt = nextCaptureTime(now)
    }
    await tx.update(attempts).set({ nextCaptureAt }).where(eq(attempts.id, attemptId))

    return {
      ackedSeq: head.seq,
      status: attempt.status,
      deadline: attempt.deadline.getTime(),
      serverTime: now,
      chainBroken: chainBrokenAt !== null,
      commands: open ? await pendingCommands(tx, attemptId) : [],
    }
  })
}

/** A malformed event (e.g. a value that cannot be canonicalized) counts as a broken link, never as a server error. */
async function verifies(event: Event, head: ChainHead, key: CryptoKey) {
  let result: VerifyResult
  try {
    result = await verifyEvent(event, head, key)
  } catch {
    return false
  }
  return result.ok
}

async function applyEvent(
  tx: Tx,
  attemptId: string,
  event: Event,
  ctx: { question: typeof questions.$inferSelect | undefined; counts: boolean; now: number },
) {
  if (event.type === 'answer') {
    if (!ctx.question || !ctx.counts || !isValidAnswer(ctx.question, event.data.value)) return
    await tx
      .insert(answers)
      .values({ attemptId, questionId: ctx.question.id, value: event.data.value, seq: event.seq })
      .onConflictDoUpdate({
        target: [answers.attemptId, answers.questionId],
        set: { value: event.data.value, seq: event.seq },
        setWhere: sql`${answers.seq} < ${event.seq}`,
      })
  }
  if (event.type === 'command.received') {
    await tx
      .update(commands)
      .set({ deliveredAt: new Date(ctx.now) })
      .where(and(eq(commands.attemptId, attemptId), eq(commands.id, event.data.commandId)))
  }
}

/** Commands stay pending until the client acknowledges them in its chain, so a lost response loses nothing. */
async function pendingCommands(tx: Tx, attemptId: string): Promise<Command[]> {
  const rows = await tx
    .select()
    .from(commands)
    .where(and(eq(commands.attemptId, attemptId), isNull(commands.deliveredAt)))
  return rows.map((c) =>
    c.type === 'warn'
      ? { id: c.id, type: 'warn', message: c.payload.message ?? '' }
      : { id: c.id, type: 'capture', seconds: c.payload.seconds ?? CONTROL_FRAGMENT_SECONDS },
  )
}

async function attemptById(tx: Tx, attemptId: string) {
  const [row] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for('update')
  if (!row) throw notFound('Attempt not found')
  return row
}
