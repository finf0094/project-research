<script setup lang="ts">
import { ExamDefinition } from '@exam/contracts'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, AppCard } from '@/shared/ui'
import { createExam, getExam, updateExam } from '../api'
import ExamSettingsForm from '../components/ExamSettingsForm.vue'
import ParticipantsEditor from '../components/ParticipantsEditor.vue'
import QuestionList from '../components/QuestionList.vue'
import { emptyExam } from '../draft'
import { describeIssues } from '../issues'

/** Creates a new exam (/examiner/exams/new) or edits one (/examiner/exams/:examId/edit). */
const route = useRoute()
const router = useRouter()
// /new and /:examId/edit are separate page instances; the watch also covers a route reused in place.
const examId = computed(() => (route.params.examId ? String(route.params.examId) : null))
const draft = ref<ExamDefinition | null>(null)
const participants = ref<string[]>([])
const locked = ref(false)
const saved = ref(false)
const invalid = ref<string[]>([])
const load = useAction()
const save = useAction({ 409: 'authoring.lockedNow' as const })
const { t } = useI18n()

watch(
  examId,
  (id) => {
    // Nothing of the previous exam may stay on screen (or be saved onto this one) while it loads.
    draft.value = id ? null : emptyExam(Date.now())
    participants.value = []
    locked.value = false
    saved.value = false
    invalid.value = []
    if (!id) return
    void load.run(async () => {
      const exam = await getExam(id)
      draft.value = exam.definition
      participants.value = exam.participants
      locked.value = exam.locked
    })
  },
  { immediate: true },
)

const questions = computed({
  get: () => draft.value!.questions,
  set: (value) => (draft.value = { ...draft.value!, questions: value }),
})

async function submit() {
  saved.value = false
  // The server checks the same contract; checking first names the fields instead of a bare "bad request".
  const parsed = ExamDefinition.safeParse(draft.value)
  invalid.value = parsed.success ? [] : describeIssues(parsed.error.issues, t)
  if (!parsed.success) return
  const id = examId.value
  const ok = await save.run(async () => {
    if (id) await updateExam(id, parsed.data)
    else return router.replace(`/examiner/exams/${(await createExam(parsed.data)).id}/edit`)
    saved.value = true
  })
  // Students started meanwhile: show the exam as it now is (frozen) instead of a form that cannot save.
  if (!ok && id && save.error.value === 'authoring.lockedNow') locked.value = true
}
</script>

<template>
  <main class="page">
    <header>
      <RouterLink to="/examiner" class="crumb">{{ $t('authoring.back') }}</RouterLink>
      <h1>{{ examId ? draft?.title || $t('authoring.editTitle') : $t('authoring.newTitle') }}</h1>
    </header>
    <p v-if="load.error.value" class="error" role="alert">{{ $t(load.error.value) }}</p>

    <template v-if="draft">
      <p v-if="locked" class="notice" role="status">{{ $t('authoring.locked') }}</p>
      <form class="layout" @submit.prevent="submit">
        <div class="main">
          <AppCard><ExamSettingsForm v-model="draft" :disabled="locked" /></AppCard>
          <AppCard>
            <QuestionList v-model="questions" :disabled="locked" :oral="draft.profile.mode === 'oral'" />
          </AppCard>
        </div>
        <AppCard as="aside" class="side">
          <AppButton v-if="!locked" type="submit" block :loading="save.busy.value">
            {{ examId ? $t('authoring.save') : $t('authoring.create') }}
          </AppButton>
          <p v-if="saved" class="ok" role="status">{{ $t('authoring.saved') }}</p>
          <p v-if="invalid.length" class="error" role="alert">
            {{ $t('authoring.invalid', { details: invalid.join(', ') }) }}
          </p>
          <p v-if="save.error.value" class="error" role="alert">{{ $t(save.error.value) }}</p>
          <ParticipantsEditor v-if="examId" :key="examId" :exam-id="examId" :initial="participants" />
          <p v-else class="muted">{{ $t('authoring.participants.afterCreate') }}</p>
        </AppCard>
      </form>
    </template>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-6);
}
.crumb {
  font-size: var(--text-sm);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-4);
  align-items: start;
}
.main,
.side {
  display: grid;
  gap: var(--space-4);
}
.side {
  position: sticky;
  top: var(--space-4);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
}
.ok {
  color: var(--ok);
  font-weight: 600;
}
.error {
  color: var(--danger);
}
@media (width < 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
}
</style>
