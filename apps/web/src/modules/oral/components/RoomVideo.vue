<script setup lang="ts">
import { Video, VideoOff, Volume2 } from 'lucide-vue-next'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppButton } from '@/shared/ui'
import type { RoomState } from '../live-room'

const props = defineProps<{
  stream: MediaStream | null
  state: RoomState
  who: string
  audioBlocked: boolean
}>()
defineEmits<{ retry: []; startAudio: [] }>()
const { t } = useI18n()

const video = ref<HTMLVideoElement>()
watchEffect(() => {
  if (video.value) video.value.srcObject = props.stream
})

/** Problems stay visible over the picture too (a frozen frame looks like a working call). */
const problem = computed(() => props.state !== 'connected' && (props.state !== 'idle' || !props.stream))
const status = computed(() =>
  props.state === 'connected' && !props.stream ? t('oral.waiting') : t(`oral.state.${props.state}`),
)
</script>

<template>
  <div class="room">
    <!-- Muted: the sound is played by the call itself, so autoplay rules never block the picture. -->
    <video v-show="stream" ref="video" muted playsinline autoplay :aria-label="who" />
    <p class="visually-hidden" role="status">{{ status }}</p>

    <div v-if="!stream || problem" class="overlay" :class="{ dim: stream }">
      <component :is="state === 'connected' ? Video : VideoOff" :size="32" aria-hidden="true" />
      <p aria-hidden="true">{{ status }}</p>
      <AppButton v-if="state === 'disconnected'" variant="lime" @click="$emit('retry')">{{
        $t('oral.reconnect')
      }}</AppButton>
    </div>
    <span v-if="stream" class="who">{{ who }}</span>
    <AppButton v-if="audioBlocked" class="sound" variant="lime" @click="$emit('startAudio')">
      <Volume2 :size="18" aria-hidden="true" /> {{ $t('oral.enableSound') }}
    </AppButton>
  </div>
</template>

<style scoped>
.room {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink-2);
}
video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  text-align: center;

  &.dim {
    background: color-mix(in oklab, var(--ink) 70%, transparent);
  }
}
.who,
.sound {
  position: absolute;
  inset-block-end: var(--space-3);
}
.who {
  inset-inline-start: var(--space-3);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: color-mix(in oklab, var(--ink) 70%, transparent);
  font-size: var(--text-sm);
}
.sound {
  inset-inline-end: var(--space-3);
}
</style>
