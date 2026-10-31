import { isEmptyAnswer, type AnswerValue, type Question } from '@exam/contracts'
import { computed, ref, toRaw, type Ref } from 'vue'
import { putAnswer } from '@/modules/offline'
import type { ExamSession } from './exam-session'
import { createTextDrafts } from './text-drafts'

export const isAnswered = (value: AnswerValue | undefined) => !isEmptyAnswer(value)

/**
 * The student's answers. Choices are saved at once; text after a pause, on blur, on page hide and before
 * finishing. Saving means: sealed into the event log and stored on the device in one step.
 */
export function useAnswers(
  session: () => ExamSession | null,
  questions: Ref<Question[]>,
  locked: Ref<boolean>,
) {
  const answers = ref<Record<string, AnswerValue>>({})
  /** When each answer was last stored on the device during this visit (earlier ones show without a time). */
  const savedAt = ref<Record<string, number>>({})
  /** Questions whose latest answer the device refused to store; any of them means "not all saved". */
  const failedOn = ref<string[]>([])
  const saveFailed = computed(() => failedOn.value.length > 0)
  const drafts = createTextDrafts(persist)
  const answeredCount = computed(() => questions.value.filter((q) => isAnswered(answers.value[q.id])).length)

  function answer(questionId: string, value: AnswerValue) {
    if (!session() || locked.value) return
    answers.value = { ...answers.value, [questionId]: value }
    if (questions.value.find((q) => q.id === questionId)?.type === 'text') {
      drafts.schedule(questionId)
    } else {
      drafts.cancel(questionId)
      void persist(questionId)
    }
  }

  async function persist(questionId: string) {
    const rt = session()
    // The stored answer is a reactive proxy for arrays; IndexedDB can only clone the plain value.
    const value = toRaw(answers.value[questionId])
    if (!rt || value === undefined) return
    try {
      await rt.log.append('answer', { questionId, value }, () => putAnswer(rt.attemptId, questionId, value))
      failedOn.value = failedOn.value.filter((id) => id !== questionId)
      savedAt.value = { ...savedAt.value, [questionId]: Date.now() }
      rt.sync.wake()
    } catch (error) {
      // The device refused to store it (e.g. disk full): say so, never pretend it is saved.
      console.error('answer not saved', error)
      if (!failedOn.value.includes(questionId)) failedOn.value = [...failedOn.value, questionId]
    }
  }

  /** Takes the answer back: an empty value of the question's kind, saved like any other change. */
  function clear(questionId: string) {
    const multiple = questions.value.find((q) => q.id === questionId)?.type === 'multiple'
    answer(questionId, multiple ? [] : '')
  }

  function reset(saved: Record<string, AnswerValue> = {}) {
    drafts.discard()
    answers.value = saved
    savedAt.value = {}
    failedOn.value = []
  }

  return { answers, savedAt, failedOn, saveFailed, answeredCount, answer, clear, flush: drafts.flush, reset }
}
