<script setup lang="ts">
import type { AttemptDetail } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { RoomVideo, TicketList, examinerRoomAccess, useLiveRoom, useOwnCamera } from '@/modules/oral'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, AppCard, AppDialog } from '@/shared/ui'
import { getAttempt, sendCommand } from '../api'

/** The examiner's side of an oral exam: the student on video, the drawn ticket, and ending the exam. */
const route = useRoute()
const attemptId = String(route.params.attemptId)
const detail = ref<AttemptDetail | null>(null)
const call = useLiveRoom()
const camera = useOwnCamera()
const action = useAction({ 409: 'review.notRunning' as const })
const ending = ref(false)

const running = computed(() => detail.value?.summary.status === 'active')

async function join() {
  call.setLocal(await camera.ensure())
  await call.join(() => examinerRoomAccess(attemptId))
}

// A finished attempt has nobody to talk to: no call, no camera.
onMounted(() =>
  action.run(async () => {
    detail.value = await getAttempt(attemptId)
    if (running.value) await join()
  }),
)

function end() {
  ending.value = false
  return action.run(async () => {
    await sendCommand(attemptId, { type: 'terminate' })
    await call.leave()
    camera.stop()
    detail.value = await getAttempt(attemptId)
  })
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
    <p v-if="action.error.value" class="error" role="alert">{{ $t(action.error.value) }}</p>
    <p v-if="camera.missing.value" class="error" role="alert">{{ $t('review.room.noCamera') }}</p>

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
