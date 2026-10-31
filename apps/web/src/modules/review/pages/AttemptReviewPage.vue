<script setup lang="ts">
import type { AttemptDetail, DecisionBody } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppCard } from '@/shared/ui'
import { chunkUrl, decide, getAttempt, judgeMarker } from '../api'
import AnswersList from '../components/AnswersList.vue'
import AttemptHeader from '../components/AttemptHeader.vue'
import DecisionForm from '../components/DecisionForm.vue'
import FragmentPlayer from '../components/FragmentPlayer.vue'
import MarkerList from '../components/MarkerList.vue'
import MarkerTimeline from '../components/MarkerTimeline.vue'

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
  selected.value ??= fresh.markers.find((m) => m.status === 'pending')?.id ?? null
}

onMounted(() => action.run(load))

const marker = computed(() => detail.value?.markers.find((m) => m.id === selected.value) ?? null)
const sources = computed(() => (marker.value?.chunks ?? []).map((hash) => chunkUrl(attemptId, hash)))
const end = computed(() => detail.value?.submittedAt ?? detail.value?.summary.lastSeenAt ?? 0)
const editable = computed(() => ['ready_for_review', 'decided'].includes(detail.value?.summary.status ?? ''))

const judge = (id: string, status: 'confirmed' | 'dismissed') =>
  action.run(async () => {
    saving.error.value = null // only the latest failure is shown
    await judgeMarker(id, status)
    await load()
  })

async function save(body: DecisionBody) {
  saved.value = false
  action.error.value = null // only the latest failure is shown
  await saving.run(async () => {
    await decide(attemptId, body)
    saved.value = true // saved even if the reload below fails
    await load()
  })
}
</script>

<template>
  <p v-if="action.error.value ?? saving.error.value" class="error" role="alert">
    {{ $t((action.error.value ?? saving.error.value)!) }}
  </p>
  <main v-if="detail" class="page">
    <AttemptHeader :detail="detail" />

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
          <h2>{{ $t('review.attempt.markers') }}</h2>
          <p class="muted note">{{ $t('review.attempt.markersNote') }}</p>
          <p v-if="!detail.markers.length" class="muted">{{ $t('review.attempt.noMarkers') }}</p>
          <MarkerList
            :markers="detail.markers"
            :selected="selected"
            :editable="editable"
            @select="selected = $event"
            @judge="judge"
          />
        </AppCard>
        <AppCard class="stack">
          <h2>{{ $t('review.attempt.answers') }}</h2>
          <AnswersList :answers="detail.answers" />
        </AppCard>
      </div>

      <AppCard as="aside" class="side">
        <DecisionForm
          v-if="editable"
          :current="detail.decision"
          :saving="saving.busy.value"
          :with-score="detail.examMode === 'oral'"
          @save="save"
        />
        <p v-else class="muted">{{ $t('review.attempt.waitAnalysis') }}</p>
        <p v-if="saved" class="saved" role="status">{{ $t('review.attempt.saved') }}</p>
      </AppCard>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-6);
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
