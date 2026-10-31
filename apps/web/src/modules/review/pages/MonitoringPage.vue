<script setup lang="ts">
import type { AttemptSummary, ExaminerCommandBody, ExaminerExam } from '@exam/contracts'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppCard, StatTile } from '@/shared/ui'
import { listAttempts, listExams, sendCommand } from '../api'
import AttemptsTable from '../components/AttemptsTable.vue'
import CommandDialog from '../components/CommandDialog.vue'

const POLL_MS = 5000
const route = useRoute()
const router = useRouter()
const examId = String(route.params.examId)
const exam = ref<ExaminerExam | null>(null)
const attempts = ref<AttemptSummary[]>([])
const acting = ref<AttemptSummary | null>(null)
const stale = ref(false)
const action = useAction({ 409: 'review.notRunning' as const })
// An error belongs to the student it was about: it goes when the dialog closes or another opens.
watch(acting, () => (action.error.value = null))

async function refresh() {
  try {
    attempts.value = await listAttempts(examId)
    stale.value = false
  } catch {
    stale.value = true
  }
}
onMounted(async () => {
  exam.value = (await listExams().catch(() => [])).find((e) => e.id === examId) ?? null
  await refresh()
})
// Polling keeps the server simple (no SSE); five seconds is fresh enough for a proctor.
const poll = setInterval(refresh, POLL_MS)
onUnmounted(() => clearInterval(poll))

const count = (pred: (a: AttemptSummary) => boolean) => attempts.value.filter(pred).length
const stats = computed(() => ({
  writing: count((a) => a.status === 'active'),
  offline: count((a) => a.connection === 'offline'),
  submitted: count((a) => ['submitted', 'ready_for_review', 'decided'].includes(a.status)),
  toReview: count((a) => a.status === 'ready_for_review'),
}))

async function send(body: ExaminerCommandBody) {
  const target = acting.value
  if (!target || action.busy.value) return
  const sent = await action.run(() => sendCommand(target.id, body))
  // The examiner may have moved on to another student meanwhile: the result belongs to this one only.
  if (acting.value !== target) action.error.value = null
  else if (sent) acting.value = null
  await refresh()
}
</script>

<template>
  <main class="page">
    <header>
      <RouterLink to="/examiner" class="crumb">{{ $t('review.exams.title') }}</RouterLink>
      <h1>{{ exam?.title ?? $t('review.monitoring.exam') }}</h1>
    </header>

    <section class="stats" :aria-label="$t('review.monitoring.summary')">
      <StatTile :label="$t('review.monitoring.writing')" :value="stats.writing" />
      <StatTile
        :label="$t('review.monitoring.offline')"
        :value="stats.offline"
        :note="$t('review.monitoring.offlineNote')"
        tone="sky"
      />
      <StatTile :label="$t('review.monitoring.submitted')" :value="stats.submitted" />
      <StatTile :label="$t('review.monitoring.toReview')" :value="stats.toReview" tone="peach" />
    </section>

    <AppCard>
      <h2>{{ $t('review.monitoring.students') }}</h2>
      <p class="muted note">
        {{ $t('review.monitoring.riskNote') }}
        <span v-if="stale"> · {{ $t('review.monitoring.stale') }}</span>
      </p>
      <AttemptsTable
        :attempts="attempts"
        :oral="exam?.mode === 'oral'"
        @act="acting = $event"
        @room="router.push(`/examiner/attempts/${$event.id}/room`)"
        @review="router.push(`/examiner/attempts/${$event.id}`)"
      />
    </AppCard>

    <CommandDialog
      :attempt="acting"
      :sending="action.busy.value"
      :error="action.error.value"
      @send="send"
      @close="acting = null"
    />
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
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}
.note {
  margin-block: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
}
</style>
