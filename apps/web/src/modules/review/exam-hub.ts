import type { AttemptSummary, ExaminerExam } from '@exam/contracts'
import { inject, onScopeDispose, provide, ref, type InjectionKey, type Ref } from 'vue'
import { ApiError } from '@/shared/lib/http'
import { alertsBetween, type Alert } from './alerts'
import { getExam, listAttempts } from './api'
import { useLiveUpdates } from './live-updates'

export interface ExamHub {
  examId: string
  exam: Ref<ExaminerExam | null>
  attempts: Ref<AttemptSummary[]>
  /** What changed during this visit that a proctor should hear about, newest first. */
  alerts: Ref<Alert[]>
  /** The page clock: countdowns and "x s ago" tick with it. */
  now: Ref<number>
  /** The last refresh failed: the numbers on screen may be old. */
  stale: Ref<boolean>
  /** The exam does not exist or is not this examiner's: nothing more is loaded. */
  missing: Ref<boolean>
  /** Stream connected: changes appear at once. */
  live: Ref<boolean>
  refresh(): Promise<void>
}

const KEY: InjectionKey<ExamHub> = Symbol('exam-hub')
const ALERTS_KEPT = 30

/**
 * The exam page's shared state: the exam and its attempts, kept current by the live stream, the alerts
 * gathered from their changes and one clock. Created once by the page and read by every tab, so switching
 * tabs needs no reload and loses no alert.
 */
export function provideExamHub(examId: string): ExamHub {
  const exam = ref<ExaminerExam | null>(null)
  const attempts = ref<AttemptSummary[]>([])
  const alerts = ref<Alert[]>([])
  const now = ref(Date.now())
  const stale = ref(false)
  const missing = ref(false)

  // Only the newest refresh is applied: the stream, the poll and commands all refresh, and answers may
  // arrive out of order.
  let latest = 0
  let loaded = false // the first load is the baseline, not news
  async function refresh() {
    if (missing.value) return
    const mine = ++latest
    try {
      const [freshExam, freshAttempts] = await Promise.all([getExam(examId), listAttempts(examId)])
      if (mine !== latest) return
      if (loaded) {
        const changes = alertsBetween(attempts.value, freshAttempts, Date.now()).reverse()
        if (changes.length) alerts.value = [...changes, ...alerts.value].slice(0, ALERTS_KEPT)
      }
      exam.value = freshExam
      attempts.value = freshAttempts
      loaded = true
      stale.value = false
    } catch (error) {
      if (mine !== latest) return
      if (error instanceof ApiError && error.status === 404) {
        missing.value = true
        stop()
      } else stale.value = true
    }
  }

  const { connected, stop } = useLiveUpdates(examId, () => void refresh())
  const clock = setInterval(() => (now.value = Date.now()), 1000)
  onScopeDispose(() => clearInterval(clock))

  const hub: ExamHub = { examId, exam, attempts, alerts, now, stale, missing, live: connected, refresh }
  provide(KEY, hub)
  void refresh()
  return hub
}

export function useExamHub(): ExamHub {
  const hub = inject(KEY)
  if (!hub) throw new Error('useExamHub outside the exam page')
  return hub
}
