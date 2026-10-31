<script setup lang="ts">
import { CircleAlert, CircleCheck } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AppButton } from '@/shared/ui'
import { saveBaseline, type Pose } from '../calibration'
import { saveTier, tierFromTiming } from '../device-tier'
import { createSensors, requestCamera, type Sensors } from '../sensors'
import { DARK_BRIGHTNESS } from '../signals'

const emit = defineEmits<{ ready: [ready: boolean] }>()

const video = ref<HTMLVideoElement>()
const state = ref<'idle' | 'starting' | 'running' | 'blocked'>('idle')
const faces = ref<number | null>(null)
const brightness = ref(255)
let stream: MediaStream | null = null
let sensors: Sensors | null = null
let timer: ReturnType<typeof setInterval> | undefined
let unmounted = false
const timings: number[] = []
const poses: Pose[] = []

const checks = computed(
  () =>
    [
      { id: 'camera', ok: state.value === 'running', hint: 'camera' },
      { id: 'face', ok: faces.value === 1, hint: faces.value && faces.value > 1 ? 'faceMany' : 'faceNone' },
      { id: 'light', ok: brightness.value >= DARK_BRIGHTNESS, hint: 'light' },
    ] as const,
)

async function start() {
  state.value = 'starting'
  try {
    stream = await requestCamera()
  } catch {
    state.value = 'blocked'
    emit('ready', false)
    return
  }
  if (unmounted) return release()
  if (video.value) video.value.srcObject = stream
  // The check runs the heaviest tier and measures it: that decides how much this computer analyses in the exam.
  sensors = await createSensors(stream, 'full', { yaw: 0, pitch: 0 })
  if (unmounted) return release()
  state.value = 'running'
  timer = setInterval(() => {
    const started = performance.now()
    const frame = sensors?.analyze(performance.now(), true)
    timings.push(performance.now() - started)
    if (timings.length >= 6) saveTier(tierFromTiming(median(timings.slice(-6))))
    // While the student looks at this screen, their pose is the neutral one for this camera position.
    if (frame?.pose) poses.push(frame.pose)
    saveBaseline(poses.slice(-10))
    faces.value = frame?.faces ?? null
    brightness.value = sensors?.brightness() ?? 255
    emit(
      'ready',
      checks.value.every((c) => c.ok),
    )
  }, 500)
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]!
}

function release() {
  clearInterval(timer)
  sensors?.dispose()
  stream?.getTracks().forEach((t) => t.stop())
}

// The check frees the camera when it is done; the exam page asks for it again (the permission is remembered).
onMounted(start)
onUnmounted(() => {
  unmounted = true
  release()
})
</script>

<template>
  <div class="device-check">
    <div class="frame">
      <video ref="video" muted playsinline autoplay aria-hidden="true" />
      <p v-if="state !== 'running'" class="overlay">
        <template v-if="state === 'blocked'">{{ $t('proctoring.check.blocked') }}</template>
        <template v-else>{{ $t('proctoring.camera.starting') }}</template>
      </p>
    </div>
    <ul class="checks">
      <li v-for="check in checks" :key="check.id" class="check">
        <CircleCheck v-if="check.ok" class="ok" :size="22" aria-hidden="true" />
        <CircleAlert v-else class="bad" :size="22" aria-hidden="true" />
        <div>
          <p class="title">{{ $t(`proctoring.check.${check.id}`) }}</p>
          <p v-if="!check.ok" class="muted hint">{{ $t(`proctoring.check.hint.${check.hint}`) }}</p>
        </div>
      </li>
    </ul>
    <AppButton v-if="state === 'blocked'" variant="ink" @click="start">{{
      $t('proctoring.check.again')
    }}</AppButton>
  </div>
</template>

<style scoped>
.device-check {
  display: grid;
  gap: var(--space-4);
}
.frame {
  position: relative;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  background: var(--ink);
}
video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--space-4);
  color: var(--on-ink-2);
  text-align: center;
}
.checks {
  display: grid;
  gap: var(--space-3);
  padding: 0;
  list-style: none;
}
.check {
  display: flex;
  gap: var(--space-3);
}
.title {
  font-weight: 600;
}
.hint {
  font-size: var(--text-sm);
}
.ok {
  color: var(--ok);
}
.bad {
  color: var(--warn);
}
</style>
