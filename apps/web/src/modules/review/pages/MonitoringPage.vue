<script setup lang="ts">
import type { AttemptSummary, ExaminerCommandBody, ExaminerExam } from '@exam/contracts'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const actionError = ref('')

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
  if (!acting.value) return
  actionError.value = ''
  try {
    await sendCommand(acting.value.id, body)
    acting.value = null
    await refresh()
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Не удалось выполнить действие'
  }
}
</script>

<template>
  <main class="page">
    <header>
      <RouterLink to="/examiner" class="crumb">Экзамены</RouterLink>
      <h1>{{ exam?.title ?? 'Экзамен' }}</h1>
    </header>

    <section class="stats" aria-label="Сводка">
      <StatTile label="Пишут сейчас" :value="stats.writing" />
      <StatTile label="Без сети" :value="stats.offline" note="экзамен у них продолжается" tone="sky" />
      <StatTile label="Сдали" :value="stats.submitted" />
      <StatTile label="Ждут проверки" :value="stats.toReview" tone="peach" />
    </section>

    <AppCard>
      <h2>Студенты</h2>
      <p class="muted note">
        Приоритет проверки только упорядочивает список. Пропадание интернета на него не влияет.
        <span v-if="stale"> · Нет связи с сервером, данные могут быть устаревшими.</span>
      </p>
      <AttemptsTable
        :attempts="attempts"
        @act="acting = $event"
        @review="router.push(`/examiner/attempts/${$event.id}`)"
      />
    </AppCard>

    <CommandDialog :attempt="acting" @send="send" @close="acting = null" />
    <p v-if="actionError" class="error" role="alert">Действие не выполнено: {{ actionError }}</p>
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
.error {
  color: var(--danger);
}
.note {
  margin-block: var(--space-2) var(--space-4);
  font-size: var(--text-sm);
}
</style>
