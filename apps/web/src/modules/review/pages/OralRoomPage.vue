<script setup lang="ts">
import type { AttemptDetail } from '@exam/contracts'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { RoomVideo, TicketList, examinerRoomAccess, useLiveRoom } from '@/modules/oral'
import { errorKey, type ErrorKey } from '@/shared/lib/error-key'
import { AppButton, AppCard, AppDialog } from '@/shared/ui'
import { getAttempt, sendCommand } from '../api'

/** The examiner's side of an oral exam: the student on video, the drawn ticket, and ending the exam. */
const route = useRoute()
const attemptId = String(route.params.attemptId)
const detail = ref<AttemptDetail | null>(null)
const call = useLiveRoom()
const ending = ref(false)
const error = ref<ErrorKey | 'review.room.noCamera' | 'review.notRunning' | null>(null)
let camera: MediaStream | null = null
let unmounted = false

const running = computed(() => detail.value?.summary.status === 'active')

/** The examiner's own camera and microphone; a dead or missing one is asked for again. */
async function ensureCamera() {
  if (camera?.getTracks().some((t) => t.readyState === 'live')) return
  try {
    const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    // The page may have closed while the permission prompt was open.
    if (unmounted) return media.getTracks().forEach((t) => t.stop())
    camera = media
    error.value = null
  } catch {
    error.value = 'review.room.noCamera'
  }
  call.setLocal(camera)
}

async function join() {
  await ensureCamera()
  if (!unmounted) await call.join(() => examinerRoomAccess(attemptId))
}

onMounted(async () => {
  try {
    detail.value = await getAttempt(attemptId)
    // A finished attempt has nobody to talk to: no call, no camera.
    if (running.value) await join()
  } catch (e) {
    error.value = errorKey(e, { 409: 'review.notRunning' as const })
  }
})
onUnmounted(() => {
  unmounted = true
  camera?.getTracks().forEach((t) => t.stop())
})

async function end() {
  ending.value = false
  try {
    await sendCommand(attemptId, { type: 'terminate' })
    await call.leave()
    camera?.getTracks().forEach((t) => t.stop())
    camera = null
    detail.value = await getAttempt(attemptId)
  } catch (e) {
    error.value = errorKey(e, { 409: 'review.notRunning' as const })
  }
}
</script>

<template>
  <main class="page">
    <header>
      <RouterLink :to="`/examiner/attempts/${attemptId}`" class="crumb">{{
        $t('review.room.back')
      }}</RouterLink>
      <h1>{{ detail?.summary.student.name ?? $t('review.room.title') }}</h1>
    </header>
    <p v-if="error" class="error" role="alert">{{ $t(error) }}</p>

    <div class="layout">
      <AppCard class="stack">
        <RoomVideo
          v-if="running"
          :stream="call.remote.value"
          :state="call.state.value"
          :audio-blocked="call.audioBlocked.value"
          :who="$t('review.room.student')"
          @retry="join"
          @start-audio="call.startAudio"
        />
        <p v-else-if="detail" class="muted">{{ $t('review.room.ended') }}</p>
      </AppCard>
      <AppCard as="aside" class="stack">
        <TicketList v-if="detail" :questions="detail.answers.map((a) => a.question)" />
        <AppButton v-if="running" variant="danger" @click="ending = true">{{
          $t('review.room.end')
        }}</AppButton>
        <p class="muted note">{{ $t('review.room.scoreNote') }}</p>
      </AppCard>
    </div>

    <AppDialog :open="ending" :title="$t('review.room.confirmTitle')" @close="ending = false">
      <p>{{ $t('review.room.confirmText') }}</p>
      <template #actions>
        <AppButton variant="secondary" @click="ending = false">{{ $t('common.cancel') }}</AppButton>
        <AppButton variant="danger" @click="end">{{ $t('review.room.confirm') }}</AppButton>
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
