<script setup lang="ts">
import { Check, RotateCcw, Sun } from 'lucide-vue-next'
import { computed, ref, watchEffect } from 'vue'
import { AppButton } from '@/shared/ui'
import type { ProbeState } from '../device-probe'
import { DARK_BRIGHTNESS } from '../signals'

/**
 * The camera picture of the check: an oval to sit in, a chip saying whether the student is seen well,
 * and a light meter. `faces`/`brightness` come from the probe's last analysed frame.
 */
const props = defineProps<{
  state: ProbeState
  stream: MediaStream | null
  faces: number | null
  brightness: number
}>()
defineEmits<{ retry: [] }>()

const video = ref<HTMLVideoElement>()
watchEffect(() => {
  if (video.value) video.value.srcObject = props.stream
})

/** What the chip says: seen well, nobody, or too many people. */
const seen = computed(() =>
  props.faces === 1 ? 'good' : props.faces && props.faces > 1 ? 'many' : props.faces === 0 ? 'none' : null,
)
const SEGMENTS = 6
/** Lit segments: the dark threshold lights two of them, a well-lit room all six. */
const lit = computed(() =>
  Math.min(SEGMENTS, Math.round((props.brightness / (DARK_BRIGHTNESS * 3)) * SEGMENTS)),
)
const light = computed(() =>
  props.brightness < DARK_BRIGHTNESS ? 'dark' : lit.value < SEGMENTS ? 'ok' : 'good',
)
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
      <p v-if="state === 'running' && seen" :key="seen" class="chip" :class="seen" role="status">
        <Check v-if="seen === 'good'" :size="14" aria-hidden="true" />
        {{ $t(`proctoring.stage.${seen}`) }}
      </p>
    </Transition>

    <div v-if="state !== 'running'" class="overlay">
      <p>{{ $t(state === 'blocked' ? 'proctoring.check.blocked' : 'proctoring.camera.starting') }}</p>
      <AppButton v-if="state === 'blocked'" variant="lime" @click="$emit('retry')">
        <RotateCcw :size="16" aria-hidden="true" /> {{ $t('proctoring.check.again') }}
      </AppButton>
    </div>

    <div v-else class="meter" :class="light">
      <Sun :size="16" aria-hidden="true" />
      <span>{{ $t('proctoring.check.light') }}</span>
      <span
        class="segments"
        role="meter"
        :aria-valuenow="lit"
        aria-valuemin="0"
        :aria-valuemax="SEGMENTS"
        :aria-label="$t('proctoring.check.light')"
      >
        <span v-for="i in SEGMENTS" :key="i" :class="{ on: i <= lit }" />
      </span>
      <b>{{ $t(`proctoring.stage.light.${light}`) }}</b>
    </div>
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
    stroke: rgb(255 255 255 / 0.55);
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
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius);
  background: rgb(14 14 28 / 0.72);
  backdrop-filter: blur(8px);
  font-size: var(--text-xs);
}
.segments {
  display: flex;
  flex: 1;
  gap: 4px;
  span {
    flex: 1;
    block-size: 5px;
    border-radius: var(--radius-pill);
    background: rgb(255 255 255 / 0.18);
    transition: background-color var(--dur) var(--ease);
  }
}
.meter .on {
  background: var(--lime);
}
.meter.dark .on {
  background: var(--peach);
}
</style>
