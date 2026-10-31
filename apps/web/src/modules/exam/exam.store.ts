import type { AttemptStatus, Question, SyncResponse } from '@exam/contracts'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import {
  clearRecording,
  createServerClock,
  listAnswers,
  openEventLog,
  updateAttempt,
  type EndReason,
  type LocalAttempt,
} from '@/modules/offline'
import { useProctoringStore } from '@/modules/proctoring'
import { isAnswered, useAnswers } from './answers'
import { createCommandInbox } from './commands'
import { startExamSession, type ExamSession } from './exam-session'
import { loadAttempt } from './local-attempt'
import { submitWhenDelivered } from './submit'
import { acquireTabLock } from './tab-lock'

const FINISHED: readonly AttemptStatus[] = ['submitted', 'ready_for_review', 'decided']

/**
 * The running attempt: answers, navigation, time, proctoring and finishing. Every change goes into the
 * local event log first; the sync loop delivers it whenever the network allows. Nothing here waits for it.
 */
export const useExamStore = defineStore('exam', () => {
  const attempt = shallowRef<LocalAttempt | null>(null)
  const current = ref(0)
  const deadline = ref(0)
  const remainingMs = ref(0)
  const status = ref<AttemptStatus>('active')
  const endedBy = ref<EndReason | null>(null)
  const chainBroken = ref(false)
  const warning = ref<string | null>(null)
  const openedElsewhere = ref(false)
  const signedOut = ref(false)

  const proctoring = useProctoringStore()
  let runtime: ExamSession | null = null
  /** Bumped by open/close so a slow open() that lost the race cleans up instead of starting a second session. */
  let generation = 0
  const inbox = createCommandInbox({
    warn: (message) => (warning.value = message),
    capture: (seconds) => !locked.value && proctoring.capture(seconds),
  })

  const questions = computed<Question[]>(() => attempt.value?.exam.questions ?? [])
  const question = computed(() => questions.value[current.value])
  const finished = computed(() => FINISHED.includes(status.value))
  const locked = computed(() => endedBy.value !== null || finished.value)
  const { answers, savedAt, failedOn, saveFailed, answeredCount, answer, clear, flush, reset } = useAnswers(
    () => runtime,
    questions,
    locked,
  )

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
    reset(saved)
    deadline.value = local.deadline
    status.value = local.status
    endedBy.value = local.endedBy
    current.value = Math.max(
      0,
      questions.value.findIndex((q) => !isAnswered(saved[q.id])),
    )

    // The chain records the session before anything else, including a possible auto-finish below.
    if (!locked.value) await log.append(local.head.seq === 0 ? 'session.started' : 'session.resumed', {})
    if (gen !== generation) return releaseLock()

    runtime = startExamSession(attemptId, log, clock, releaseLock, {
      onResponse: (response) => handleResponse(gen, response),
      onUnauthorized: () => (signedOut.value = true),
      onPageHide: () => void flush(),
      onTick: tick,
    })
    tick()

    if (!locked.value) {
      void proctoring.start({
        attemptId,
        log,
        recording: local.exam.profile.recording,
        // In an oral exam the student talks the whole time: sound says nothing there.
        listen: local.exam.profile.mode !== 'oral',
        now: () => clock.now(),
      })
    }
  }

  /**
   * Locks the answers and submits as soon as everything is on the server; survives reloads and outages.
   * Proctoring stops first: its last evidence must be in the chain before `session.submitted` closes it.
   */
  async function finish(reason: EndReason = 'student') {
    const rt = runtime
    if (!rt || locked.value) return
    endedBy.value = reason
    await flush()
    await proctoring.stop().catch((error) => console.error('proctoring did not stop cleanly', error))
    // Whatever was not pinned is no longer needed, even if proctoring never ran on this device.
    await clearRecording(rt.attemptId).catch(() => undefined)
    await rt.log.append('session.submitted', {}, () => updateAttempt(rt.attemptId, { endedBy: reason }))
    rt.sync.wake()
  }

  function goTo(index: number) {
    current.value = Math.min(Math.max(index, 0), questions.value.length - 1)
  }

  function close() {
    generation++
    if (runtime) {
      void flush()
      void proctoring.stop()
      runtime.stop()
    }
    reset()
    runtime = null
    attempt.value = null
    status.value = 'active'
    endedBy.value = null
    chainBroken.value = false
    warning.value = null
    openedElsewhere.value = false
    signedOut.value = false
    inbox.clear()
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

    await inbox.receive(response.commands, rt.log)

    if (status.value === 'terminated') await finish('examiner')
    if (!endedBy.value || finished.value) return
    const outcome = await submitWhenDelivered(rt, response)
    if (outcome === 'signed-out') signedOut.value = true
    else if (outcome !== 'waiting') status.value = outcome.status
  }

  return {
    attempt,
    answers,
    savedAt,
    failedOn,
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
    questions,
    question,
    answeredCount,
    open,
    answer,
    clear,
    /** Saves typed text right away (on blur), without waiting for the pause. */
    saveNow: flush,
    finish,
    goTo,
    close,
  }
})
