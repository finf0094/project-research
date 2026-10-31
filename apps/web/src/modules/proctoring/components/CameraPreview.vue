<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { AppButton } from '@/shared/ui'
import { useProctoringStore } from '../proctoring.store'

const proctoring = useProctoringStore()
const video = ref<HTMLVideoElement>()
watchEffect(() => {
  if (video.value) video.value.srcObject = proctoring.stream
})
</script>

<template>
  <div class="preview" :class="proctoring.camera">
    <video v-show="proctoring.camera === 'on'" ref="video" muted playsinline autoplay aria-hidden="true" />
    <div class="text">
      <template v-if="proctoring.camera === 'on'">
        <p class="title">Камера включена</p>
        <p class="muted">Запись хранится на устройстве</p>
      </template>
      <template v-else-if="proctoring.camera === 'blocked'">
        <p class="title">Камера выключена</p>
        <p class="muted">Разрешите доступ к камере в браузере</p>
        <AppButton variant="ink" @click="proctoring.retry">Включить камеру</AppButton>
      </template>
      <p v-else class="muted">Включаем камеру…</p>
    </div>
  </div>
</template>

<style scoped>
.preview {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface-2);

  &.blocked {
    flex-direction: column;
    align-items: stretch;
    background: var(--warn-tint);
  }
}
video {
  inline-size: 72px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: var(--radius-sm);
  background: var(--ink);
  transform: scaleX(-1);
}
.text {
  display: grid;
  gap: 2px;
  font-size: var(--text-sm);
}
.title {
  font-weight: 600;
}
</style>
