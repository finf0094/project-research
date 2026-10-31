<script setup lang="ts">
import { watch } from 'vue'
import { RoomVideo, TicketList, studentRoomAccess, useLiveRoom } from '@/modules/oral'
import { CameraPreview, useProctoringStore } from '@/modules/proctoring'
import { AppCard } from '@/shared/ui'
import ExamLayout from '../components/ExamLayout.vue'
import { useAttemptPage } from '../use-attempt-page'

/**
 * Oral exam: the student answers the drawn ticket to the examiner on a live call. Everything else is the
 * written exam's machinery — event log, proctoring and the local recording (the profile records in full).
 */
const { exam, attemptId, loadError, confirming, open, finish } = useAttemptPage('oral')
const proctoring = useProctoringStore()
const call = useLiveRoom()

const join = () => call.join(() => studentRoomAccess(attemptId.value))
// Joins while the attempt runs. The camera may come later (permission prompt) or come back after a restart.
watch(
  () => exam.attempt?.exam.profile.mode === 'oral' && !exam.locked,
  (running) => (running ? join() : call.leave()),
  { immediate: true },
)
watch(() => proctoring.stream, call.setLocal, { immediate: true })
</script>

<template>
  <ExamLayout
    v-model:confirming="confirming"
    :attempt-id="attemptId"
    :step="$t('exam.header.oral')"
    :load-error="loadError"
    :unanswered="0"
    oral
    @retry="open(attemptId)"
    @finish="finish"
  >
    <div class="body">
      <RoomVideo
        :stream="call.remote.value"
        :local="proctoring.stream"
        :state="call.state.value"
        :audio-blocked="call.audioBlocked.value"
        :who="$t('exam.page.examiner')"
        recording
        @retry="join"
        @start-audio="call.startAudio"
      />
      <aside class="side">
        <AppCard><TicketList :questions="exam.questions" /></AppCard>
        <CameraPreview v-if="proctoring.camera !== 'on'" />
        <p class="muted note">{{ $t('exam.page.oralHint') }}</p>
      </aside>
    </div>
  </ExamLayout>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: var(--space-4);
  align-items: start;
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
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
