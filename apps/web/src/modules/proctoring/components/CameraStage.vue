<script setup lang="ts">
import { Check, RotateCcw } from 'lucide-vue-next'
import { computed, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { AppButton } from '@/shared/ui'
import type { ProbeState } from '../device-probe'
import LightMeter from './LightMeter.vue'

/**
 * The camera picture of the check: an oval to sit in, a chip saying whether the student is seen well,
 * and a light meter. `faces`/`brightness` come from the probe's last analysed frame.
 */
const props = defineProps<{
  state: ProbeState
  stream: MediaStream | null
  faces: number | null
  brightness: number | null
}>()
const { t } = useI18n()
defineEmits<{ retry: [] }>()

const video = ref<HTMLVideoElement>()
watchEffect(() => {
  if (video.value) video.value.srcObject = props.stream
})

/** What the chip says: seen well, nobody, or too many people. */
const seen = computed(() =>
  props.faces === 1 ? 'good' : props.faces && props.faces > 1 ? 'many' : props.faces === 0 ? 'none' : null,
)
const OVERLAY = {
  idle: 'proctoring.camera.starting',
  starting: 'proctoring.camera.starting',
  blocked: 'proctoring.check.blocked',
  failed: 'proctoring.check.failed',
} as const

// Read aloud only once the picture settles for a second: the face count may flicker frame to frame.
const announced = ref('')
let settle: ReturnType<typeof setTimeout> | undefined
watch(seen, (now) => {
  clearTimeout(settle)
  settle = setTimeout(() => (announced.value = now ? t(`proctoring.stage.${now}`) : ''), 1000)
})
</script>

<template>
  <div class="stage" :class="state">
    <video ref="video" muted playsinline autoplay aria-hidden="true" />
    <svg
      class="oval"
      :class="{ fits: seen === 'good' }"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <ellipse cx="50" cy="46" rx="17" ry="33" vector-effect="non-scaling-stroke" />
    </svg>

    <Transition name="pop" mode="out-in">
      <p v-if="state === 'running' && seen" :key="seen" class="chip" :class="seen" aria-hidden="true">
        <Check v-if="seen === 'good'" :size="14" aria-hidden="true" />
        {{ $t(`proctoring.stage.${seen}`) }}
      </p>
    </Transition>
    <p class="visually-hidden" role="status">{{ state === 'running' ? announced : '' }}</p>

    <div v-if="state !== 'running'" class="overlay">
      <p role="status">{{ $t(OVERLAY[state]) }}</p>
      <AppButton v-if="state === 'blocked' || state === 'failed'" variant="lime" @click="$emit('retry')">
        <RotateCcw :size="16" aria-hidden="true" /> {{ $t('proctoring.check.again') }}
      </AppButton>
    </div>

    <LightMeter v-else class="meter" :brightness="brightness" />
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  overflow: hidden;
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
video {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.oval {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  ellipse {
    fill: none;
    stroke: var(--on-ink-edge);
    stroke-width: 2;
    stroke-dasharray: 6 6;
    transition: stroke var(--dur) var(--ease);
  }
  &.fits ellipse {
    stroke: var(--lime);
    stroke-dasharray: none;
    animation: settle var(--dur-slow) var(--ease-spring);
  }
}
@keyframes settle {
  from {
    stroke-width: 6;
  }
}
.chip {
  position: absolute;
  inset: var(--space-4) auto auto var(--space-4);
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 6px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--peach);
  color: var(--on-peach);
  font-size: var(--text-xs);
  font-weight: 700;
  &.good {
    background: var(--lime);
    color: var(--on-lime);
  }
}
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease),
    scale var(--dur-fast) var(--ease);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  scale: 0.9;
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  color: var(--on-ink-2);
  text-align: center;
}
.meter {
  position: absolute;
  inset: auto var(--space-4) var(--space-4);
}
</style>
