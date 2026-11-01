<script setup lang="ts">
import { useRoute } from 'vue-router'
import { AppCard, PageSkeleton } from '@/shared/ui'
import AnswersList from '../components/AnswersList.vue'
import AttemptHeader from '../components/AttemptHeader.vue'
import DecisionForm from '../components/DecisionForm.vue'
import MarkerList from '../components/MarkerList.vue'
import MarkerSummary from '../components/MarkerSummary.vue'
import OralRecording from '../components/OralRecording.vue'
import ReviewStage from '../components/ReviewStage.vue'
import { useAttemptReview } from '../use-attempt-review'

/**
 * Reviewing one attempt: the recording around each marker on a dark stage, the markers to confirm or
 * dismiss, the answers, and the decision; the queue's next student is one click away.
 */

const route = useRoute()
const {
  detail,
  selected,
  saved,
  action,
  saving,
  queue,
  marker,
  sources,
  audioUrl,
  end,
  needsScore,
  editable,
  judge,
  save,
} = useAttemptReview(String(route.params.attemptId))
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
          :audio-url="audioUrl"
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
  <PageSkeleton v-else-if="!action.error.value" />
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
