<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RoomVideo, TicketList, studentRoomAccess, useLiveRoom } from '@/modules/oral'
import { CameraPreview, HintBanner, useProctoringStore } from '@/modules/proctoring'
import { AppCard } from '@/shared/ui'
import ExamHeader from '../components/ExamHeader.vue'
import ExaminerMessage from '../components/ExaminerMessage.vue'
import ExamNotices from '../components/ExamNotices.vue'
import ExamUnavailable from '../components/ExamUnavailable.vue'
import FinishDialog from '../components/FinishDialog.vue'
import { useExamStore } from '../exam.store'

/**
 * Oral exam: the student answers the drawn ticket to the examiner on a live call. Everything else is the
 * written exam's machinery — event log, proctoring and the local recording (the profile records in full).
 */
const route = useRoute()
const router = useRouter()
const exam = useExamStore()
const proctoring = useProctoringStore()
const call = useLiveRoom()
const attemptId = computed(() => String(route.params.attemptId))
const confirming = ref(false)
const loadError = ref(false)

async function open(id: string) {
  loadError.value = false
  try {
    await exam.open(id)
  } catch {
    loadError.value = true
  }
}
watch(attemptId, open, { immediate: true })

const join = () => call.join(() => studentRoomAccess(attemptId.value))
// Joins while the attempt runs. The camera may come later (permission prompt) or come back after a restart.
watch(
  () => !!exam.attempt && !exam.locked,
  (running) => (running ? join() : call.leave()),
  { immediate: true },
)
watch(() => proctoring.stream, call.setLocal, { immediate: true })
watch(
  () => exam.locked,
  (locked) => locked && router.replace(`/attempts/${attemptId.value}/done`),
)
onUnmounted(() => {
  if (!exam.locked) exam.close()
})

function confirmFinish() {
  confirming.value = false
  void exam.finish()
}
</script>

<template>
  <ExamUnavailable v-if="loadError" reason="load" oral @retry="open(attemptId)" />
  <ExamUnavailable v-else-if="exam.openedElsewhere" reason="elsewhere" />

  <div v-else-if="exam.attempt" class="exam">
    <ExamHeader
      :title="exam.attempt.exam.title"
      :step="$t('exam.header.oral')"
      :remaining-ms="exam.remainingMs"
      :finishing="exam.locked"
      @finish="confirming = true"
    />
    <ExamNotices
      :attempt-id="attemptId"
      :signed-out="exam.signedOut"
      :save-failed="exam.saveFailed"
      :chain-broken="exam.chainBroken"
    />
    <HintBanner />

    <div class="body">
      <AppCard class="main">
        <RoomVideo
          :stream="call.remote.value"
          :state="call.state.value"
          :audio-blocked="call.audioBlocked.value"
          :who="$t('exam.page.examiner')"
          @retry="join"
          @start-audio="call.startAudio"
        />
        <TicketList :questions="exam.questions" />
      </AppCard>
      <AppCard as="aside" class="side">
        <CameraPreview />
        <p class="muted note">{{ $t('exam.page.oralHint') }}</p>
      </AppCard>
    </div>

    <FinishDialog :open="confirming" :unanswered="0" @confirm="confirmFinish" @cancel="confirming = false" />
    <ExaminerMessage :message="exam.warning" @close="exam.warning = null" />
  </div>
</template>

<style scoped>
.exam {
  display: grid;
  gap: var(--space-4);
  min-height: 100dvh;
  padding: var(--space-4);
  align-content: start;
}
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: var(--space-4);
  align-items: start;
}
.main {
  display: grid;
  gap: var(--space-6);
  padding: var(--space-6);
}
.side {
  display: grid;
  gap: var(--space-4);
}
.note {
  font-size: var(--text-sm);
}
@media (width < 900px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
