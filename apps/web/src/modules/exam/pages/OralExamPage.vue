<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { RoomVideo, TicketList, studentRoomAccess, useLiveRoom } from '@/modules/oral'
import { CameraPreview, HintBanner, useProctoringStore } from '@/modules/proctoring'
import { AppButton, AppCard, AppDialog } from '@/shared/ui'
import ExamHeader from '../components/ExamHeader.vue'
import ExamNotices from '../components/ExamNotices.vue'
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

const join = () => call.join(() => studentRoomAccess(attemptId.value), proctoring.stream)
// Joins once the attempt is running; the camera may come later (prompt) or come back after a restart.
watch(
  () => exam.attempt && !exam.locked,
  (running) => (running ? join() : call.leave()),
  { immediate: true },
)
watch(
  () => proctoring.stream,
  (stream) => call.state.value === 'connected' && call.publish(stream),
)
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
  <main v-if="loadError" class="center">
    <AppCard>
      <h1>Не удалось открыть экзамен</h1>
      <p class="muted">Для устного экзамена нужен интернет. Проверьте подключение.</p>
      <AppButton @click="open(attemptId)">Повторить</AppButton>
    </AppCard>
  </main>

  <main v-else-if="exam.openedElsewhere" class="center">
    <AppCard>
      <h1>Экзамен открыт в другой вкладке</h1>
      <p class="muted">Продолжайте там и закройте эту вкладку.</p>
    </AppCard>
  </main>

  <div v-else-if="exam.attempt" class="exam">
    <ExamHeader
      :title="exam.attempt.exam.title"
      step="Устный экзамен"
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
        <RoomVideo :stream="call.remote.value" :state="call.state.value" who="Преподаватель" @retry="join" />
        <TicketList :questions="exam.questions" />
      </AppCard>
      <AppCard as="aside" class="side">
        <CameraPreview />
        <p class="muted note">
          Отвечайте вслух. Когда преподаватель скажет, что ответ принят, нажмите «Сдать».
        </p>
      </AppCard>
    </div>

    <FinishDialog :open="confirming" :unanswered="0" @confirm="confirmFinish" @cancel="confirming = false" />
    <AppDialog :open="!!exam.warning" title="Сообщение преподавателя" @close="exam.warning = null">
      <p>{{ exam.warning }}</p>
      <template #actions><AppButton @click="exam.warning = null">Понятно</AppButton></template>
    </AppDialog>
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
.center {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-4);
  text-align: center;
}
@media (width < 900px) {
  .body {
    grid-template-columns: 1fr;
  }
}
</style>
