<script setup lang="ts">
import { ExamDefinition } from '@exam/contracts'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, AppCard } from '@/shared/ui'
import { createExam, getExam, updateExam } from '../api'
import ExamSettingsForm from '../components/ExamSettingsForm.vue'
import ParticipantsEditor from '../components/ParticipantsEditor.vue'
import QuestionList from '../components/QuestionList.vue'
import { emptyExam } from '../draft'

/** Creates a new exam (/examiner/exams/new) or edits one (/examiner/exams/:examId/edit). */
const route = useRoute()
const router = useRouter()
// The same page instance serves /new and /:examId/edit (after creating, the route changes under it).
const examId = computed(() => (route.params.examId ? String(route.params.examId) : null))
const draft = ref<ExamDefinition | null>(null)
const participants = ref<string[]>([])
const locked = ref(false)
const saved = ref(false)
const invalid = ref<string[]>([])
const load = useAction()
const save = useAction()

watch(
  examId,
  (id) => {
    if (!id) return void (draft.value = emptyExam(Date.now()))
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
  invalid.value = parsed.success ? [] : parsed.error.issues.map((i) => i.path.join('.') || i.message)
  if (!parsed.success) return
  await save.run(async () => {
    if (examId.value) await updateExam(examId.value, parsed.data)
    else return router.replace(`/examiner/exams/${(await createExam(parsed.data)).id}/edit`)
    saved.value = true
  })
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
          <ParticipantsEditor v-if="examId" :exam-id="examId" :initial="participants" />
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
