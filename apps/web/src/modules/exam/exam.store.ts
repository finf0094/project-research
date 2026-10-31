import type { AnswerValue, AttemptStatus, Question, SyncResponse } from '@exam/contracts'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  createServerClock,
  db,
  openEventLog,
  startSync,
  useSyncStore,
  type EventLog,
  type LocalAttempt,
  type ServerClock,
  type SyncHandle,
} from '@/modules/offline'
import { ApiError } from '@/shared/lib/http'
import { submitAttempt } from './api'
import { loadAttempt, localAnswers } from './local-attempt'
import { acquireTabLock } from './tab-lock'

const FINISHED: readonly AttemptStatus[] = ['submitted', 'ready_for_review', 'decided']

export interface OpenOptions {
  /** Called when the server asks for a control fragment; the proctoring module records it. */
  onCapture?: (seconds: number) => void
}

interface Runtime {
  log: EventLog
  clock: ServerClock
  sync: SyncHandle
  timer: ReturnType<typeof setInterval>
  releaseLock: () => void
  onCapture?: (seconds: number) => void
}

/**
 * The running attempt: answers, navigation, time and finishing. Every change goes into the local event log
 * first; the sync loop delivers it whenever the network allows. Nothing here waits for the network.
 */
export const useExamStore = defineStore('exam', () => {
  const attempt = shallowRef<LocalAttempt | null>(null)
  const answers = ref<Record<string, AnswerValue>>({})
  const current = ref(0)
  const deadline = ref(0)
  const remainingMs = ref(0)
  const status = ref<AttemptStatus>('active')
  const finishing = ref(false)
  const chainBroken = ref(false)
  const warning = ref<string | null>(null)
  const openedElsewhere = ref(false)
  const signedOut = ref(false)
  let runtime: Runtime | null = null
  const handledCommands = new Set<string>()

  const questions = computed<Question[]>(() => attempt.value?.exam.questions ?? [])
  const question = computed(() => questions.value[current.value])
  const answeredCount = computed(() => questions.value.filter((q) => isAnswered(answers.value[q.id])).length)
  const finished = computed(() => FINISHED.includes(status.value))

  async function open(attemptId: string, options: OpenOptions = {}) {
    if (attempt.value?.id === attemptId && runtime) return
    close()
    const local = await loadAttempt(attemptId)
    const releaseLock = await acquireTabLock(`exam-attempt-${attemptId}`)
    if (!releaseLock) {
      openedElsewhere.value = true
      return
    }

    const clock = createServerClock(local.clockOffset)
    const log = openEventLog(attemptId, local.key, local.head, () => clock.now())
    attempt.value = local
    answers.value = await localAnswers(attemptId)
    deadline.value = local.deadline
    status.value = local.status
    finishing.value = local.finishing
    current.value = Math.max(
      0,
      questions.value.findIndex((q) => !isAnswered(answers.value[q.id])),
    )

    const syncStore = useSyncStore()
    const sync = startSync({
      attemptId,
      log,
      clock,
      onResponse: handleResponse,
      onStatus: syncStore.set,
      onUnauthorized: () => (signedOut.value = true),
    })
    const timer = setInterval(tick, 1000)
    runtime = { log, clock, sync, timer, releaseLock, onCapture: options.onCapture }
    tick()

    if (!FINISHED.includes(local.status) && !local.finishing) {
      await log.append(local.head.seq === 0 ? 'session.started' : 'session.resumed', {})
    }
  }

  async function answer(questionId: string, value: AnswerValue) {
    if (!runtime || !attempt.value || finishing.value || finished.value) return
    const attemptId = attempt.value.id
    answers.value = { ...answers.value, [questionId]: value }
    await runtime.log.append('answer', { questionId, value }, () =>
      db.answers.put({ attemptId, questionId, value }),
    )
    runtime.sync.wake()
  }

  /** Locks the answers and submits as soon as everything is on the server; survives reloads and outages. */
  async function finish() {
    if (!runtime || !attempt.value || finishing.value || finished.value) return
    const attemptId = attempt.value.id
    finishing.value = true
    await runtime.log.append('session.submitted', {}, () =>
      db.attempts.update(attemptId, { finishing: true }),
    )
    runtime.sync.wake()
  }

  function goTo(index: number) {
    current.value = Math.min(Math.max(index, 0), questions.value.length - 1)
  }

  function close() {
    if (runtime) {
      runtime.sync.stop()
      clearInterval(runtime.timer)
      runtime.releaseLock()
    }
    runtime = null
    attempt.value = null
    openedElsewhere.value = false
    signedOut.value = false
    warning.value = null
  }

  function tick() {
    if (!runtime) return
    remainingMs.value = Math.max(0, deadline.value - runtime.clock.now())
    if (remainingMs.value === 0 && status.value === 'active') void finish()
  }

  async function handleResponse(response: SyncResponse) {
    if (!runtime || !attempt.value) return
    deadline.value = response.deadline
    status.value = response.status
    chainBroken.value = response.chainBroken
    signedOut.value = false

    for (const command of response.commands) {
      if (handledCommands.has(command.id)) continue
      handledCommands.add(command.id)
      if (command.type === 'warn') warning.value = command.message
      if (command.type === 'capture') runtime.onCapture?.(command.seconds)
      await runtime.log.append('command.received', { commandId: command.id })
    }

    if (status.value === 'terminated') await finish()
    if (finishing.value && !finished.value) await trySubmit(response)
  }

  async function trySubmit(response: SyncResponse) {
    if (!runtime || !attempt.value) return
    const head = runtime.log.head()
    if (response.ackedSeq < head.seq && !response.chainBroken) return // the next sync delivers the rest
    try {
      const result = await submitAttempt(attempt.value.id, { lastSeq: head.seq, lastHash: head.hash })
      status.value = result.status
      await db.attempts.update(attempt.value.id, { status: result.status })
    } catch (error) {
      // 409: an event appended meanwhile is still on its way; network errors: retried after the next sync.
      if (error instanceof ApiError && error.status !== 409) console.error('submit failed', error)
    }
  }

  return {
    attempt,
    answers,
    current,
    deadline,
    remainingMs,
    status,
    finishing,
    finished,
    chainBroken,
    warning,
    openedElsewhere,
    signedOut,
    questions,
    question,
    answeredCount,
    open,
    answer,
    finish,
    goTo,
    close,
  }
})

export function isAnswered(value: AnswerValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : !!value?.trim()
}
