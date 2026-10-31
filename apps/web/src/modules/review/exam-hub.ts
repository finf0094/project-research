import type { AttemptSummary, ExaminerExam } from '@exam/contracts'
import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import { getExam, listAttempts } from './api'
import { useLiveUpdates } from './live-updates'

export interface ExamHub {
  examId: string
  exam: Ref<ExaminerExam | null>
  attempts: Ref<AttemptSummary[]>
  /** The last refresh failed: the numbers on screen may be old. */
  stale: Ref<boolean>
  /** Stream connected: changes appear at once. */
  live: Ref<boolean>
  refresh(): Promise<void>
}

const KEY: InjectionKey<ExamHub> = Symbol('exam-hub')

/**
 * The exam page's shared state: the exam and its attempts, kept current by the live stream. Created once
 * by the page and read by every tab, so switching tabs needs no reload.
 */
export function provideExamHub(examId: string): ExamHub {
  const exam = ref<ExaminerExam | null>(null)
  const attempts = ref<AttemptSummary[]>([])
  const stale = ref(false)

  async function refresh() {
    try {
      ;[exam.value, attempts.value] = await Promise.all([getExam(examId), listAttempts(examId)])
      stale.value = false
    } catch {
      stale.value = true
    }
  }
  const { connected } = useLiveUpdates(examId, () => void refresh())
  const hub: ExamHub = { examId, exam, attempts, stale, live: connected, refresh }
  provide(KEY, hub)
  void refresh()
  return hub
}

export function useExamHub(): ExamHub {
  const hub = inject(KEY)
  if (!hub) throw new Error('useExamHub outside the exam page')
  return hub
}
