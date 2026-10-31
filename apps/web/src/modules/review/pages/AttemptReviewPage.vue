<script setup lang="ts">
import type { AttemptDetail, DecisionBody, UpdateMarkerBody } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppCard } from '@/shared/ui'
import { chunkUrl, decide, getAttempt, judgeMarker, listAttempts } from '../api'
import AnswersList from '../components/AnswersList.vue'
import AttemptHeader from '../components/AttemptHeader.vue'
import DecisionForm from '../components/DecisionForm.vue'
import MarkerList from '../components/MarkerList.vue'
import MarkerSummary from '../components/MarkerSummary.vue'
import OralRecording from '../components/OralRecording.vue'
import ReviewStage from '../components/ReviewStage.vue'
import { queuePlace, type QueuePlace } from '../review-queue'

/**
 * Reviewing one attempt: the recording around each marker on a dark stage, the markers to confirm or
 * dismiss, the answers, and the decision; the queue's next student is one click away.
 */

const route = useRoute()
const attemptId = String(route.params.attemptId)
const detail = ref<AttemptDetail | null>(null)
const selected = ref<string | null>(null)
const saved = ref(false)
const action = useAction()
/** Saving has its own state: judging markers must not spin the save button. */
const saving = useAction()

/** Only the newest load is applied: judging and saving both reload, and answers may arrive out of order. */
let loads = 0
async function load() {
  const mine = ++loads
  const fresh = await getAttempt(attemptId)
  if (mine !== loads) return
  detail.value = fresh
  // A re-analysis replaces markers: a selection that no longer exists moves to the next one to look at.
  if (!fresh.markers.some((m) => m.id === selected.value)) selected.value = nextPending(fresh)
}

// The queue is a convenience: without it the page still works, just without "next".
const queue = ref<QueuePlace | null>(null)
const loadQueue = (examId: string) =>
  listAttempts(examId)
    .then((list) => (queue.value = queuePlace(list, attemptId)))
    .catch(() => {})

onMounted(async () => {
  await action.run(load)
  if (detail.value) void loadQueue(detail.value.examId)
})

const marker = computed(() => detail.value?.markers.find((m) => m.id === selected.value) ?? null)
const sources = computed(() => (marker.value?.chunks ?? []).map((hash) => chunkUrl(attemptId, hash)))
const end = computed(() => detail.value?.submittedAt ?? detail.value?.summary.lastSeenAt ?? 0)
/** Oral exams and free-text answers have no automatic total: the examiner gives the score. */
const needsScore = computed(
  () => detail.value?.examMode === 'oral' || !!detail.value?.answers.some((a) => a.autoScore === null),
)
const editable = computed(() => ['ready_for_review', 'decided'].includes(detail.value?.summary.status ?? ''))

const nextPending = (d: AttemptDetail) =>
  (d.markers.find((m) => m.status === 'pending') ?? d.markers[0])?.id ?? null

/** Judging the marker on stage moves the stage on to the next one still to look at. */
const judge = (id: string, status: UpdateMarkerBody['status']) =>
  action.run(async () => {
    saving.error.value = null // only the latest failure is shown
    await judgeMarker(id, status)
    await load()
    if (status !== 'pending' && selected.value === id && detail.value)
      selected.value = nextPending(detail.value)
  })

async function save(body: DecisionBody) {
  saved.value = false
  action.error.value = null // only the latest failure is shown
  await saving.run(async () => {
    await decide(attemptId, body)
    saved.value = true // saved even if the reload below fails
    await load()
    if (detail.value) void loadQueue(detail.value.examId)
  })
}
</script>

<template>
  <p v-if="action.error.value ?? saving.error.value" class="error" role="alert">
    {{ $t((action.error.value ?? saving.error.value)!) }}
  </p>
  <main v-if="detail" class="page">
    <AttemptHeader :detail="detail" :queue="queue" />

    <div class="layout">
      <div class="main stagger">
        <ReviewStage
          v-if="detail.markers.length"
          :marker="marker"
          :sources="sources"
          :markers="detail.markers"
          :start="detail.summary.startedAt"
          :end="end"
          @select="selected = $event"
        />
        <AppCard class="stack">
          <MarkerList
            :markers="detail.markers"
            :selected="selected"
            :editable="editable"
            :busy="action.busy.value"
            @select="selected = $event"
            @judge="judge"
          />
        </AppCard>
        <OralRecording
          v-if="detail.examMode === 'oral'"
          :audio="detail.audio ?? { state: 'pending', hash: null }"
          :audio-url="detail.audio?.hash ? chunkUrl(attemptId, detail.audio.hash) : null"
          :call="detail.call"
          :end="end"
        />
        <AppCard class="stack">
          <h2>{{ $t('review.attempt.answers') }}</h2>
          <AnswersList :answers="detail.answers" />
        </AppCard>
      </div>

      <aside class="side">
        <MarkerSummary v-if="detail.markers.length" :markers="detail.markers" />
        <AppCard>
          <DecisionForm
            v-if="editable"
            :current="detail.decision"
            :saving="saving.busy.value"
            :with-score="needsScore"
            :saved="saved"
            @save="save"
          />
          <p v-else class="muted">{{ $t('review.attempt.waitAnalysis') }}</p>
        </AppCard>
      </aside>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  /* Never wider than the screen, whatever a long name or a row of buttons would like. */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-6);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
  gap: var(--space-4);
  align-items: start;
}
.main,
.stack {
  display: grid;
  gap: var(--space-4);
}
.side {
  min-inline-size: 0;
  position: sticky;
  top: var(--space-4);
  display: grid;
  gap: var(--space-4);
}
.stack h2 {
  font-size: var(--text-lg);
}
.note {
  font-size: var(--text-sm);
}
.error {
  margin-bottom: var(--space-4);
  color: var(--danger);
}
@media (width < 1000px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .side {
    position: static;
  }
}
</style>
