<script setup lang="ts">
import type { AttemptDetail, DecisionBody } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { AppCard } from '@/shared/ui'
import { chunkUrl, decide, getAttempt, judgeMarker } from '../api'
import AnswersList from '../components/AnswersList.vue'
import AttemptHeader from '../components/AttemptHeader.vue'
import DecisionForm from '../components/DecisionForm.vue'
import FragmentPlayer from '../components/FragmentPlayer.vue'
import MarkerList from '../components/MarkerList.vue'
import MarkerTimeline from '../components/MarkerTimeline.vue'

const route = useRoute()
const { t } = useI18n()
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
    error.value = e instanceof Error ? e.message : t('common.somethingWrong')
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
  <p v-if="error" class="error" role="alert">{{ $t('review.attempt.actionFailed', { error }) }}</p>
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
          :saving="saving"
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
