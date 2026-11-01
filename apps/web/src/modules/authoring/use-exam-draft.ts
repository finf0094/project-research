import { ExamDefinition, type SignalException } from '@exam/contracts'
import { ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import type { z } from 'zod'
import { useAction } from '@/shared/lib/use-action'
import { createExam, getExam, updateExam } from './api'
import { emptyExam } from './draft'
import { describeIssues } from './issues'

/**
 * The exam being edited: loaded for `examId` (or a new one), checked against the contract and saved.
 * `submit` returns the issues when the check fails, so the page can open the place that needs fixing.
 */
export function useExamDraft(examId: Ref<string | null>, onReset: () => void) {
  const router = useRouter()
  const { t } = useI18n()
  const draft = ref<ExamDefinition | null>(null)
  const participants = ref<string[]>([])
  const exceptions = ref<SignalException[]>([])
  const locked = ref(false)
  const saved = ref(false)
  const invalid = ref<string[]>([])
  const load = useAction()
  const save = useAction({ 409: 'authoring.lockedNow' as const })

  watch(
    examId,
    (id) => {
      // Nothing of the previous exam may stay on screen (or be saved onto this one) while it loads.
      draft.value = id ? null : emptyExam(Date.now())
      participants.value = []
      exceptions.value = []
      locked.value = false
      onReset()
      if (!id) return
      void load.run(async () => {
        const exam = await getExam(id)
        draft.value = exam.definition
        participants.value = exam.participants
        exceptions.value = exam.exceptions
        locked.value = exam.locked
      })
    },
    { immediate: true },
  )

  // Any edit makes the last check's list and "saved" stale (the outline's dots keep showing what is left).
  watch(
    draft,
    () => {
      invalid.value = []
      saved.value = false
    },
    { deep: true },
  )

  async function submit(): Promise<z.core.$ZodIssue[] | null> {
    saved.value = false
    // The server checks the same contract; checking first names the fields instead of a bare "bad request".
    const parsed = ExamDefinition.safeParse(draft.value)
    invalid.value = parsed.success ? [] : describeIssues(parsed.error.issues, t)
    if (!parsed.success) return parsed.error.issues
    const id = examId.value
    const ok = await save.run(async () => {
      if (id) await updateExam(id, parsed.data)
      else return router.replace(`/examiner/exams/${(await createExam(parsed.data)).id}/edit`)
      saved.value = true
    })
    // Students started meanwhile: show the exam as it now is (frozen) instead of a form that cannot save.
    if (!ok && id && save.error.value === 'authoring.lockedNow') locked.value = true
    return null
  }

  /** The server drops a removed student's exception (a returning student starts without one). */
  function participantsSaved(list: string[]) {
    participants.value = list
    exceptions.value = exceptions.value.filter((e) => list.includes(e.email))
  }

  return { draft, participants, exceptions, locked, saved, invalid, load, save, submit, participantsSaved }
}
