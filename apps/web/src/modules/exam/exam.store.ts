import type { AnswerValue, AttemptStatus, Question, SyncResponse } from '@exam/contracts'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  createServerClock,
  listAnswers,
  openEventLog,
  putAnswer,
  startSync,
  updateAttempt,
  useSyncStore,
  type EndReason,
  type EventLog,
  type LocalAttempt,
  type ServerClock,
  type SyncHandle,
} from '@/modules/offline'
import { ApiError } from '@/shared/lib/http'
import { submitAttempt } from './api'
import { loadAttempt } from './local-attempt'
import { acquireTabLock } from './tab-lock'

const FINISHED: readonly AttemptStatus[] = ['submitted', 'ready_for_review', 'decided']
/** Typing is saved after a short pause: every save is a sealed event, so not one per keystroke. */
const TEXT_SAVE_DELAY_MS = 800

/** What the proctoring module needs to write into the attempt's chain. */
export interface AttemptSession {
  attemptId: string
  log: EventLog
  now: () => number
}

/** The exam drives proctoring through this: control fragments on request, and a final stop before finishing. */
export interface AttachedProctor {
  capture(seconds: number): void
  /** Saves the last evidence; must finish before the chain is closed with `session.submitted`. */
  stop(): Promise<void>
}

interface Runtime extends AttemptSession {
  clock: ServerClock
  sync: SyncHandle
  timer: ReturnType<typeof setInterval>
  releaseLock: () => void
  onPageHide: () => void
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
  const endedBy = ref<EndReason | null>(null)
  const chainBroken = ref(false)
  const saveFailed = ref(false)
  const warning = ref<string | null>(null)
  const openedElsewhere = ref(false)
  const signedOut = ref(false)
  const session = shallowRef<AttemptSession | null>(null)

  let runtime: Runtime | null = null
  /** Bumped by open/close so a slow open() that lost the race cleans up instead of starting a second session. */
  let generation = 0
  let proctor: AttachedProctor | null = null
  const handledCommands = new Set<string>()
  const textTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const questions = computed<Question[]>(() => attempt.value?.exam.questions ?? [])
  const question = computed(() => questions.value[current.value])
  const answeredCount = computed(() => questions.value.filter((q) => isAnswered(answers.value[q.id])).length)
  const finished = computed(() => FINISHED.includes(status.value))
  const locked = computed(() => endedBy.value !== null || finished.value)

  async function open(attemptId: string) {
    if (attempt.value?.id === attemptId && runtime) return
    close()
    const gen = generation
    const local = await loadAttempt(attemptId)
    const releaseLock = await acquireTabLock(`exam-attempt-${attemptId}`)
    if (gen !== generation) return releaseLock?.()
    if (!releaseLock) {
      openedElsewhere.value = true
      return
    }
    const saved = await listAnswers(attemptId)
    if (gen !== generation) return releaseLock()

    const clock = createServerClock(local.clockOffset)
    const log = openEventLog(attemptId, local.key, local.head, () => clock.now())
    attempt.value = local
    answers.value = saved
    deadline.value = local.deadline
    status.value = local.status
    endedBy.value = local.endedBy
    current.value = Math.max(
      0,
      questions.value.findIndex((q) => !isAnswered(saved[q.id])),
    )

    // The chain records the session before anything else, including a possible auto-finish below.
    if (!locked.value) await log.append(local.head.seq === 0 ? 'session.started' : 'session.resumed', {})

    const syncStore = useSyncStore()
    const sync = startSync({
      attemptId,
      log,
      clock,
      onResponse: (response) => handleResponse(gen, response),
      onStatus: syncStore.set,
      onUnauthorized: () => (signedOut.value = true),
    })
    const onPageHide = () => void flushText()
    window.addEventListener('pagehide', onPageHide)
    const now = () => clock.now()
    runtime = { attemptId, log, now, clock, sync, releaseLock, onPageHide, timer: setInterval(tick, 1000) }
    session.value = { attemptId, log, now }
    tick()
  }

  /** Choices are saved at once; text is saved after a pause, on blur, on page hide and before finishing. */
  function answer(questionId: string, value: AnswerValue) {
    if (!runtime || locked.value) return
    answers.value = { ...answers.value, [questionId]: value }
    clearTimeout(textTimers.get(questionId))
    if (typeof value === 'string' && questions.value.find((q) => q.id === questionId)?.type === 'text') {
      textTimers.set(
        questionId,
        setTimeout(() => void persist(questionId), TEXT_SAVE_DELAY_MS),
      )
    } else {
      void persist(questionId)
    }
  }

  async function persist(questionId: string) {
    textTimers.delete(questionId)
    const rt = runtime
    const value = answers.value[questionId]
    if (!rt || value === undefined) return
    try {
      await rt.log.append('answer', { questionId, value }, () => putAnswer(rt.attemptId, questionId, value))
      saveFailed.value = false
      rt.sync.wake()
    } catch (error) {
      // The device refused to store it (e.g. disk full): say so, never pretend it is saved.
      console.error('answer not saved', error)
      saveFailed.value = true
    }
  }

  async function flushText() {
    await Promise.all([...textTimers.keys()].map((id) => (clearTimeout(textTimers.get(id)), persist(id))))
  }

  /** Locks the answers and submits as soon as everything is on the server; survives reloads and outages. */
  async function finish(reason: EndReason = 'student') {
    const rt = runtime
    if (!rt || locked.value) return
    endedBy.value = reason
    await flushText()
    await proctor?.stop().catch((error) => console.error('proctoring did not stop cleanly', error))
    await rt.log.append('session.submitted', {}, () => updateAttempt(rt.attemptId, { endedBy: reason }))
    rt.sync.wake()
  }

  function goTo(index: number) {
    current.value = Math.min(Math.max(index, 0), questions.value.length - 1)
  }

  function attachProctor(next: AttachedProctor | null) {
    proctor = next
  }

  function close() {
    generation++
    if (runtime) {
      void flushText()
      runtime.sync.stop()
      clearInterval(runtime.timer)
      window.removeEventListener('pagehide', runtime.onPageHide)
      runtime.releaseLock()
    }
    runtime = null
    session.value = null
    attempt.value = null
    answers.value = {}
    status.value = 'active'
    endedBy.value = null
    chainBroken.value = false
    saveFailed.value = false
    warning.value = null
    openedElsewhere.value = false
    signedOut.value = false
    handledCommands.clear()
    useSyncStore().reset()
  }

  function tick() {
    if (!runtime) return
    remainingMs.value = Math.max(0, deadline.value - runtime.clock.now())
    if (remainingMs.value === 0 && status.value === 'active') void finish('time')
  }

  async function handleResponse(gen: number, response: SyncResponse) {
    const rt = runtime
    if (!rt || gen !== generation) return
    deadline.value = response.deadline
    status.value = response.status
    chainBroken.value = response.chainBroken
    signedOut.value = false

    for (const command of response.commands) {
      if (handledCommands.has(command.id)) continue
      handledCommands.add(command.id)
      if (command.type === 'warn') warning.value = command.message
      if (command.type === 'capture') proctor?.capture(command.seconds)
      await rt.log.append('command.received', { commandId: command.id })
    }

    if (status.value === 'terminated') await finish('examiner')
    if (endedBy.value && !finished.value) await trySubmit(rt, response)
  }

  async function trySubmit(rt: Runtime, response: SyncResponse) {
    const head = rt.log.head()
    if (response.ackedSeq < head.seq && !response.chainBroken) return // the next sync delivers the rest
    try {
      const result = await submitAttempt(rt.attemptId, { lastSeq: head.seq, lastHash: head.hash })
      status.value = result.status
      await updateAttempt(rt.attemptId, { status: result.status })
    } catch (error) {
      // 409: an event appended meanwhile is still on its way; network errors: retried after the next sync.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) signedOut.value = true
      else if (error instanceof ApiError && error.status !== 409) console.error('submit refused', error)
    }
  }

  return {
    attempt,
    answers,
    current,
    deadline,
    remainingMs,
    status,
    endedBy,
    locked,
    finished,
    chainBroken,
    saveFailed,
    warning,
    openedElsewhere,
    signedOut,
    session,
    questions,
    question,
    answeredCount,
    open,
    answer,
    finish,
    /** Saves typed text right away (on blur), without waiting for the pause. */
    saveNow: flushText,
    goTo,
    attachProctor,
    close,
  }
})

export function isAnswered(value: AnswerValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : !!value?.trim()
}
