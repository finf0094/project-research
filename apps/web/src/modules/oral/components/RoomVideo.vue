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

/** Problems stay visible over the picture too (a frozen frame looks like a working call). */
const problem = computed(() => props.state !== 'connected' && (props.state !== 'idle' || !props.stream))
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

<style scoped>
.room {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
  /* A soft lime edge while the call is live. */
  box-shadow: 0 0 0 0 transparent;
  transition: box-shadow var(--dur-slow) var(--ease);
  &.live {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--lime) 55%, transparent);
  }
}
.remote {
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
  padding: var(--space-6);
  color: var(--on-ink-2);
  text-align: center;
  &.dim {
    background: color-mix(in oklab, var(--ink) 72%, transparent);
  }
}
.icon {
  display: grid;
  place-items: center;
  inline-size: 64px;
  block-size: 64px;
  border-radius: var(--radius-lg);
  background: rgb(255 255 255 / 0.08);
}
.message {
  color: var(--on-ink);
  font-family: var(--font-display);
  font-size: var(--text-lg);
}
.keep {
  max-inline-size: 36ch;
  font-size: var(--text-sm);
}
.top {
  position: absolute;
  inset: var(--space-3) var(--space-3) auto;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, var(--ink) 70%, transparent);
  backdrop-filter: blur(6px);
  font-size: var(--text-xs);
  font-weight: 700;
  &.on {
    background: var(--lime);
    color: var(--on-lime);
  }
  &.rec {
    background: var(--peach);
    color: var(--on-peach);
  }
}
.dot {
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  background: currentColor;
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
  inset-inline-start: 50%;
  translate: -50% 0;
}
.own {
  position: absolute;
  inset: auto var(--space-3) var(--space-3) auto;
  inline-size: clamp(96px, 22%, 200px);
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border: 2px solid rgb(255 255 255 / 0.7);
  border-radius: var(--radius);
  background: #000;
  box-shadow: var(--shadow-2);
  transform: scaleX(-1);
}
.pip-enter-active {
  transition:
    opacity var(--dur) var(--ease),
    scale var(--dur) var(--ease-spring);
}
.pip-enter-from {
  opacity: 0;
  scale: 0.8;
}
</style>
