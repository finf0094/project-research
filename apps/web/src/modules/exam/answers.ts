import type { AnswerValue, Question } from '@exam/contracts'
import { computed, ref, toRaw, type Ref } from 'vue'
import { putAnswer } from '@/modules/offline'
import type { ExamSession } from './exam-session'
import { createTextDrafts } from './text-drafts'

export function isAnswered(value: AnswerValue | undefined): boolean {
  return Array.isArray(value) ? value.length > 0 : !!value?.trim()
}

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
  const saveFailed = ref(false)
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
      saveFailed.value = false
      rt.sync.wake()
    } catch (error) {
      // The device refused to store it (e.g. disk full): say so, never pretend it is saved.
      console.error('answer not saved', error)
      saveFailed.value = true
    }
  }

  function reset(saved: Record<string, AnswerValue> = {}) {
    drafts.discard()
    answers.value = saved
    saveFailed.value = false
  }

  return { answers, saveFailed, answeredCount, answer, flush: drafts.flush, reset }
}
