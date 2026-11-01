<script setup lang="ts">
import { Mic, Video, VideoOff, Volume2 } from 'lucide-vue-next'
import { computed, ref, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppButton } from '@/shared/ui'
import type { RoomState } from '../live-room'

/**
 * The call: the other side large, your own camera small in the corner, and the call's state on top.
 * `recording`: the answer is also recorded on this device, so a drop loses nothing — said right there.
 */
const props = defineProps<{
  stream: MediaStream | null
  local?: MediaStream | null
  state: RoomState
  who: string
  audioBlocked: boolean
  recording?: boolean
}>()
defineEmits<{ retry: []; startAudio: [] }>()
const { t } = useI18n()

const remote = ref<HTMLVideoElement>()
const own = ref<HTMLVideoElement>()
// Each picture only when its own stream changes: re-setting srcObject restarts a video (a black flash).
const attach = (video: HTMLVideoElement | undefined, stream: MediaStream | null) => {
  if (video && video.srcObject !== stream) video.srcObject = stream
}
watchEffect(() => attach(remote.value, props.stream))
watchEffect(() => attach(own.value, props.local ?? null))

/** Problems stay visible over the picture (a frozen frame looks like a working call); idle is no problem. */
const problem = computed(() => props.state !== 'connected' && props.state !== 'idle')
const live = computed(() => props.state === 'connected' && !!props.stream)
const status = computed(() =>
  props.state === 'connected' && !props.stream ? t('oral.waiting') : t(`oral.state.${props.state}`),
)
</script>

<template>
  <div class="room" :class="{ live }">
    <!-- Muted: the sound is played by the call itself, so autoplay rules never block the picture. -->
    <video v-show="stream" ref="remote" class="remote" muted playsinline autoplay :aria-label="who" />
    <p class="visually-hidden" role="status">
      {{ status }}<template v-if="recording && problem"> {{ $t('oral.stillRecording') }}</template>
    </p>

    <div v-if="!stream || problem" class="overlay" :class="{ dim: stream }">
      <span class="icon" aria-hidden="true"
        ><component :is="state === 'connected' ? Video : VideoOff" :size="28"
      /></span>
      <p class="message" aria-hidden="true">{{ status }}</p>
      <p v-if="recording && problem" class="keep" aria-hidden="true">{{ $t('oral.stillRecording') }}</p>
      <AppButton v-if="state === 'disconnected'" variant="lime" @click="$emit('retry')">{{
        $t('oral.reconnect')
      }}</AppButton>
    </div>

    <div class="top">
      <span class="chip" :class="live ? 'on' : 'off'" aria-hidden="true">
        <span class="dot" :class="{ live }" />{{ live ? $t('oral.onAir') : status }}
      </span>
      <span v-if="recording" class="chip rec"
        ><Mic :size="14" aria-hidden="true" /> {{ $t('oral.recording') }}</span
      >
    </div>

    <span v-if="stream" class="who">{{ who }}</span>
    <Transition name="pip">
      <video v-if="local" ref="own" class="own" muted playsinline autoplay aria-hidden="true" />
    </Transition>
    <AppButton v-if="audioBlocked" class="sound" variant="lime" @click="$emit('startAudio')">
      <Volume2 :size="18" aria-hidden="true" /> {{ $t('oral.enableSound') }}
    </AppButton>
  </div>
</template>

<style scoped src="./room-video.css"></style>
