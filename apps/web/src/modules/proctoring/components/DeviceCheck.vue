<script setup lang="ts">
import { CircleAlert, CircleCheck } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { AppButton } from '@/shared/ui'
import { createSensors, requestCamera, type Sensors } from '../sensors'

const emit = defineEmits<{ ready: [ready: boolean] }>()

const video = ref<HTMLVideoElement>()
const state = ref<'idle' | 'starting' | 'running' | 'blocked'>('idle')
const faces = ref<number | null>(null)
const brightness = ref(255)
let stream: MediaStream | null = null
let sensors: Sensors | null = null
let timer: ReturnType<typeof setInterval> | undefined

const checks = computed(() => [
  {
    title: 'Камера',
    ok: state.value === 'running',
    hint: 'Разрешите доступ к камере и микрофону в браузере.',
  },
  {
    title: 'Вас видно',
    ok: faces.value === 1,
    hint:
      faces.value && faces.value > 1
        ? 'В кадре должны быть только вы.'
        : 'Сядьте так, чтобы лицо было в кадре.',
  },
  {
    title: 'Освещение',
    ok: brightness.value >= 45,
    hint: 'Слишком темно: включите свет или повернитесь к окну.',
  },
])

async function start() {
  state.value = 'starting'
  try {
    stream = await requestCamera()
  } catch {
    state.value = 'blocked'
    emit('ready', false)
    return
  }
  if (video.value) video.value.srcObject = stream
  sensors = await createSensors(stream)
  state.value = 'running'
  timer = setInterval(() => {
    faces.value = sensors?.faces(performance.now()) ?? null
    brightness.value = sensors?.brightness() ?? 255
    emit(
      'ready',
      checks.value.every((c) => c.ok),
    )
  }, 500)
}

// The check frees the camera when it is done; the exam page asks for it again (the permission is remembered).
onMounted(start)
onUnmounted(() => {
  clearInterval(timer)
  sensors?.dispose()
  stream?.getTracks().forEach((t) => t.stop())
})
</script>

<template>
  <div class="device-check">
    <div class="frame">
      <video ref="video" muted playsinline autoplay aria-hidden="true" />
      <p v-if="state !== 'running'" class="overlay">
        <template v-if="state === 'blocked'">Камера не видна — нужно разрешение браузера</template>
        <template v-else>Включаем камеру…</template>
      </p>
    </div>
    <ul class="checks">
      <li v-for="check in checks" :key="check.title" class="check">
        <CircleCheck v-if="check.ok" class="ok" :size="22" aria-hidden="true" />
        <CircleAlert v-else class="bad" :size="22" aria-hidden="true" />
        <div>
          <p class="title">{{ check.title }}</p>
          <p v-if="!check.ok" class="muted hint">{{ check.hint }}</p>
        </div>
      </li>
    </ul>
    <AppButton v-if="state === 'blocked'" variant="ink" @click="start">Проверить снова</AppButton>
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
