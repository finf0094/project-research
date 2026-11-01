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
const local = ref<MediaStream | null>(null)
const action = useAction({ 409: 'review.notRunning' as const })
const ending = ref(false)

const running = computed(() => detail.value?.summary.status === 'active')

async function join() {
  local.value = await camera.ensure()
  call.setLocal(local.value)
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
    local.value = null
    detail.value = await getAttempt(attemptId)
  })
}
</script>

<template>
  <main class="page">
    <header class="head">
      <nav class="crumbs" :aria-label="$t('hub.crumbs')">
        <RouterLink to="/examiner">{{ $t('review.exams.title') }}</RouterLink>
        <span aria-hidden="true">/</span>
        <template v-if="detail">
          <RouterLink :to="`/examiner/exams/${detail.examId}/monitoring`">{{ detail.examTitle }}</RouterLink>
          <span aria-hidden="true">/</span>
        </template>
        <span aria-current="page">{{ $t('review.room.title') }}</span>
      </nav>
      <h1>{{ detail?.summary.student.name ?? $t('review.room.title') }}</h1>
    </header>
    <p v-if="action.error.value" class="error" role="alert">{{ $t(action.error.value) }}</p>
    <p v-if="camera.missing.value" class="error" role="alert">{{ $t('review.room.noCamera') }}</p>
    <div class="layout">
      <RoomVideo
        v-if="running"
        :stream="call.remote.value"
        :local="local"
        :state="call.state.value"
        :audio-blocked="call.audioBlocked.value"
        :who="$t('review.room.student')"
        @retry="join"
        @start-audio="call.startAudio"
      />
      <AppCard v-else-if="detail" class="ended">
        <p>{{ $t('review.room.ended') }}</p>
        <AppButton :to="`/examiner/attempts/${attemptId}`" icon="arrow">{{
          $t('review.room.back')
        }}</AppButton>
      </AppCard>
      <aside class="side">
        <AppCard v-if="detail"><TicketList :questions="detail.answers.map((a) => a.question)" /></AppCard>
        <AppButton v-if="running" variant="danger" block @click="ending = true">{{
          $t('review.room.end')
        }}</AppButton>
        <p class="muted note">{{ $t('review.room.scoreNote') }}</p>
      </aside>
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
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
}
.head {
  display: grid;
  gap: var(--space-2);
  h1 {
    font-size: clamp(var(--text-xl), 3vw, var(--text-2xl));
  }
}
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--text-2);
  font-size: var(--text-sm);
  a {
    color: inherit;
  }
  [aria-current] {
    color: var(--text);
    font-weight: 600;
  }
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
  gap: var(--space-4);
  align-items: start;
}
.side,
.ended {
  display: grid;
  gap: var(--space-4);
}
.ended {
  justify-items: start;
}
.note {
  font-size: var(--text-sm);
}
.error {
  color: var(--danger);
}
@media (width < 1000px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
