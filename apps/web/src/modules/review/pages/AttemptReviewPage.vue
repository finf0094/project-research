<script setup lang="ts">
import type { AttemptDetail, DecisionBody } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatDateTime } from '@/shared/lib/format'
import { AppCard, StatusPill } from '@/shared/ui'
import { chunkUrl, decide, getAttempt, judgeMarker } from '../api'
import AnswersList from '../components/AnswersList.vue'
import DecisionForm from '../components/DecisionForm.vue'
import FragmentPlayer from '../components/FragmentPlayer.vue'
import MarkerList from '../components/MarkerList.vue'
import MarkerTimeline from '../components/MarkerTimeline.vue'
import { STATUS_LABEL } from '../labels'

const route = useRoute()
const attemptId = String(route.params.attemptId)
const detail = ref<AttemptDetail | null>(null)
const selected = ref<string | null>(null)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

async function load() {
  detail.value = await getAttempt(attemptId)
  selected.value ??= detail.value.markers.find((m) => m.status === 'pending')?.id ?? null
}

/** Runs an action and shows its failure instead of leaving a stale or blank page. */
async function attempt(action: () => Promise<unknown>) {
  error.value = ''
  try {
    await action()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Что-то пошло не так'
  }
}
onMounted(() => attempt(load))

const marker = computed(() => detail.value?.markers.find((m) => m.id === selected.value) ?? null)
const sources = computed(() => (marker.value?.chunks ?? []).map((hash) => chunkUrl(attemptId, hash)))
const end = computed(() => detail.value?.submittedAt ?? detail.value?.summary.lastSeenAt ?? 0)
const editable = computed(() => ['ready_for_review', 'decided'].includes(detail.value?.summary.status ?? ''))

const judge = (id: string, status: 'confirmed' | 'dismissed') =>
  attempt(async () => {
    await judgeMarker(id, status)
    await load()
  })

async function save(body: DecisionBody) {
  saving.value = true
  saved.value = false
  await attempt(async () => {
    await decide(attemptId, body)
    saved.value = true
    await load()
  })
  saving.value = false
}
</script>

<template>
  <p v-if="error" class="error" role="alert">Не удалось выполнить действие: {{ error }}</p>
  <main v-if="detail" class="page">
    <header class="head">
      <RouterLink :to="`/examiner`" class="crumb">{{ detail.examTitle }}</RouterLink>
      <h1>{{ detail.summary.student.name }}</h1>
      <div class="facts">
        <StatusPill :tone="STATUS_LABEL[detail.summary.status].tone">{{
          STATUS_LABEL[detail.summary.status].text
        }}</StatusPill>
        <StatusPill v-if="detail.submittedAt" tone="off"
          >Сдан {{ formatDateTime(detail.submittedAt) }}</StatusPill
        >
        <StatusPill v-if="detail.summary.riskScore !== null" tone="accent"
          >Приоритет {{ detail.summary.riskScore }}</StatusPill
        >
        <StatusPill
          v-if="detail.serverAnalysis && detail.serverAnalysis !== 'ok'"
          tone="warn"
          title="Часть меток может отсутствовать: сервер не просмотрел эти записи сам"
          >{{
            detail.serverAnalysis === 'partial'
              ? 'Запись проверена сервером частично'
              : 'Запись сервером не проверена'
          }}</StatusPill
        >
      </div>
    </header>

    <div class="layout">
      <div class="main">
        <AppCard class="stack">
          <FragmentPlayer :sources="sources" />
          <MarkerTimeline
            :markers="detail.markers"
            :start="detail.summary.startedAt"
            :end="end"
            :selected="selected"
            @select="selected = $event"
          />
        </AppCard>
        <AppCard class="stack">
          <h2>Метки</h2>
          <p class="muted note">
            Метки расставлены автоматически. Это повод посмотреть, а не доказательство нарушения.
          </p>
          <p v-if="!detail.markers.length" class="muted">Меток нет.</p>
          <MarkerList
            :markers="detail.markers"
            :selected="selected"
            :editable="editable"
            @select="selected = $event"
            @judge="judge"
          />
        </AppCard>
        <AppCard class="stack">
          <h2>Ответы</h2>
          <AnswersList :answers="detail.answers" />
        </AppCard>
      </div>

      <AppCard as="aside" class="side">
        <DecisionForm
          v-if="editable"
          :current="detail.decision"
          :saving="saving"
          :with-score="detail.examMode === 'oral'"
          @save="save"
        />
        <p v-else class="muted">Решение можно принять, когда анализ записи завершится.</p>
        <p v-if="saved" class="saved" role="status">Решение сохранено</p>
      </AppCard>
    </div>
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
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: var(--space-4);
  align-items: start;
}
.main,
.stack {
  display: grid;
  gap: var(--space-4);
}
.side {
  position: sticky;
  top: var(--space-4);
}
.note {
  font-size: var(--text-sm);
}
.error {
  margin-bottom: var(--space-4);
  color: var(--danger);
}
.saved {
  margin-top: var(--space-3);
  color: var(--ok);
  font-weight: 600;
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
