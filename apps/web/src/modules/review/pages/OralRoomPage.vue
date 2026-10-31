<script setup lang="ts">
import type { AttemptDetail } from '@exam/contracts'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { RoomVideo, TicketList, examinerRoomAccess, useLiveRoom } from '@/modules/oral'
import { AppButton, AppCard, AppDialog } from '@/shared/ui'
import { getAttempt, sendCommand } from '../api'

/** The examiner's side of an oral exam: the student on video, the drawn ticket, and ending the exam. */
const route = useRoute()
const attemptId = String(route.params.attemptId)
const detail = ref<AttemptDetail | null>(null)
const call = useLiveRoom()
const camera = ref<MediaStream | null>(null)
const ending = ref(false)
const error = ref('')

async function join() {
  error.value = ''
  try {
    camera.value ??= await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  } catch {
    error.value = 'Нет доступа к камере и микрофону: студент вас не увидит и не услышит.'
  }
  await call.join(() => examinerRoomAccess(attemptId), camera.value)
}

onMounted(async () => {
  try {
    detail.value = await getAttempt(attemptId)
    await join()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось открыть попытку'
  }
})
onUnmounted(() => camera.value?.getTracks().forEach((t) => t.stop()))

async function end() {
  ending.value = false
  try {
    await sendCommand(attemptId, { type: 'terminate' })
    await call.leave()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Не удалось завершить экзамен'
  }
}
</script>

<template>
  <main class="page">
    <header>
      <RouterLink :to="`/examiner/attempts/${attemptId}`" class="crumb">Разбор попытки</RouterLink>
      <h1>{{ detail?.summary.student.name ?? 'Устный экзамен' }}</h1>
    </header>
    <p v-if="error" class="error" role="alert">{{ error }}</p>

    <div class="layout">
      <AppCard class="stack">
        <RoomVideo :stream="call.remote.value" :state="call.state.value" who="Студент" @retry="join" />
      </AppCard>
      <AppCard as="aside" class="stack">
        <TicketList v-if="detail" :questions="detail.answers.map((a) => a.question)" />
        <AppButton variant="danger" @click="ending = true">Завершить экзамен</AppButton>
        <p class="muted note">Баллы выставляются на странице разбора, когда запись будет обработана.</p>
      </AppCard>
    </div>

    <AppDialog :open="ending" title="Завершить экзамен?" @close="ending = false">
      <p>Экзамен студента будет остановлен, видеосвязь закроется.</p>
      <template #actions>
        <AppButton variant="secondary" @click="ending = false">Отмена</AppButton>
        <AppButton variant="danger" @click="end">Завершить</AppButton>
      </template>
    </AppDialog>
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
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: var(--space-4);
  align-items: start;
}
.stack {
  display: grid;
  gap: var(--space-4);
}
.note {
  font-size: var(--text-sm);
}
.error {
  color: var(--danger);
}
@media (width < 1000px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
