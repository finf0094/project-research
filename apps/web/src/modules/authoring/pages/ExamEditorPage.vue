<script setup lang="ts">
import { ExamDefinition } from '@exam/contracts'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { AppCard } from '@/shared/ui'
import EditorHeader from '../components/EditorHeader.vue'
import ExamSettingsForm from '../components/ExamSettingsForm.vue'
import ExceptionsEditor from '../components/ExceptionsEditor.vue'
import ParticipantsEditor from '../components/ParticipantsEditor.vue'
import QuestionsWorkspace from '../components/QuestionsWorkspace.vue'
import SaveBar from '../components/SaveBar.vue'
import { questionsWithIssues } from '../issues'
import { useExamDraft } from '../use-exam-draft'

/**
 * Creates a new exam (/examiner/exams/new) or edits one (/examiner/exams/:examId/edit), in three steps:
 * the settings, the questions (outline, editor, student preview) and the participants. The form is
 * checked against the contract, so a problem on a hidden step is named and shown, not silently blocked.
 */
const route = useRoute()
// /new and /:examId/edit are separate page instances; the draft also follows a route reused in place.
const examId = computed(() => (route.params.examId ? String(route.params.examId) : null))
type Step = 'settings' | 'questions' | 'participants'
const step = ref<Step>('settings')
const selected = ref(0)
const { draft, participants, exceptions, locked, saved, invalid, load, save, submit } = useExamDraft(
  examId,
  () => {
    step.value = 'settings'
    selected.value = 0
  },
)
const { t } = useI18n()

// Questions that would fail the check, marked in the outline as the examiner goes.
const issues = computed(() => {
  const parsed = draft.value ? ExamDefinition.safeParse(draft.value) : null
  return parsed && !parsed.success ? questionsWithIssues(parsed.error.issues) : new Set<number>()
})
/** What the save bar says: what is wrong, that it saved, or what comes after creating. */
const saveMessage = computed(() =>
  invalid.value.length
    ? { tone: 'error' as const, text: t('authoring.invalid', { details: invalid.value.join(', ') }) }
    : save.error.value
      ? { tone: 'error' as const, text: t(save.error.value) }
      : saved.value
        ? { tone: 'ok' as const, text: t('authoring.saved') }
        : examId.value
          ? null
          : { tone: 'muted' as const, text: t('authoring.participants.afterCreate') },
)
const totalPoints = computed(() => draft.value?.questions.reduce((sum, q) => sum + q.points, 0) ?? 0)
const steps = computed(() => [
  { value: 'settings' as const, label: t('authoring.steps.settings') },
  {
    value: 'questions' as const,
    label: t('authoring.steps.questions'),
    count: draft.value?.questions.length,
  },
  ...(examId.value ? [{ value: 'participants' as const, label: t('authoring.steps.participants') }] : []),
])

const questions = computed({
  get: () => draft.value!.questions,
  set: (value) => (draft.value = { ...draft.value!, questions: value }),
})

/** Saves; when the check fails, opens the first place that needs fixing. */
async function send() {
  const problems = await submit()
  if (!problems) return
  const inSettings = problems.some((i) => i.path[0] !== 'questions')
  step.value = inSettings ? 'settings' : 'questions'
  const first = [...questionsWithIssues(problems)][0]
  if (!inSettings && first !== undefined) selected.value = first
}
</script>

<template>
  <main class="page">
    <EditorHeader
      v-model:step="step"
      :exam-id="examId"
      :title="draft?.title ?? ''"
      :count="draft?.questions.length ?? null"
      :points="totalPoints"
      :steps="steps"
    />
    <p v-if="load.error.value" class="error" role="alert">{{ $t(load.error.value) }}</p>

    <form v-if="draft" class="form" novalidate @submit.prevent="send">
      <p v-if="locked" class="notice" role="status">{{ $t('authoring.locked') }}</p>
      <Transition name="step" mode="out-in">
        <AppCard v-if="step === 'settings'" key="settings" class="narrow">
          <ExamSettingsForm v-model="draft" :disabled="locked" />
        </AppCard>
        <QuestionsWorkspace
          v-else-if="step === 'questions'"
          key="questions"
          v-model="questions"
          v-model:selected="selected"
          :disabled="locked"
          :oral="draft.profile.mode === 'oral'"
          :issues="issues"
        />
        <AppCard v-else key="participants" class="narrow">
          <ParticipantsEditor
            v-if="examId"
            :key="examId"
            :exam-id="examId"
            :initial="participants"
            @saved="participants = $event"
          />
          <ExceptionsEditor
            v-if="examId"
            v-model:exceptions="exceptions"
            :exam-id="examId"
            :participants="participants"
          />
        </AppCard>
      </Transition>

      <SaveBar
        v-if="!locked"
        :message="saveMessage"
        :saving="save.busy.value"
        :label="examId ? $t('authoring.save') : $t('authoring.create')"
      />
    </form>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}
.form {
  display: grid;
  gap: var(--space-4);
}
.narrow {
  max-inline-size: 760px;
}
.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
}
.error {
  color: var(--danger);
}
.step-enter-active,
.step-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease),
    translate var(--dur-fast) var(--ease);
}
.step-enter-from {
  opacity: 0;
  translate: 0 10px;
}
.step-leave-to {
  opacity: 0;
}
</style>
