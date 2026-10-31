<script setup lang="ts">
import { Video, VideoOff } from 'lucide-vue-next'
import { ref, watchEffect } from 'vue'
import { AppButton } from '@/shared/ui'
import type { RoomState } from '../live-room'

const props = defineProps<{ stream: MediaStream | null; state: RoomState; who: string }>()
defineEmits<{ retry: [] }>()

const video = ref<HTMLVideoElement>()
watchEffect(() => {
  if (video.value) video.value.srcObject = props.stream
})

const TEXT: Record<RoomState, string> = {
  idle: 'Видеосвязь не подключена',
  connecting: 'Подключаем видеосвязь…',
  connected: 'Ждём собеседника',
  reconnecting: 'Связь прервалась, переподключаемся…',
  disconnected: 'Видеосвязь потеряна',
  unavailable: 'Видеосвязь не настроена на сервере',
}
</script>

<template>
  <div class="room">
    <video v-show="stream" ref="video" playsinline autoplay :aria-label="who" />
    <div v-if="!stream" class="placeholder" role="status">
      <component :is="state === 'connected' ? Video : VideoOff" :size="32" aria-hidden="true" />
      <p>{{ TEXT[state] }}</p>
      <AppButton v-if="state === 'disconnected'" variant="ink" @click="$emit('retry')"
        >Подключиться снова</AppButton
      >
    </div>
    <span v-else class="who">{{ who }}</span>
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
.placeholder {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  block-size: 100%;
  padding: var(--space-4);
  text-align: center;
}
.who {
  position: absolute;
  inset-block-end: var(--space-3);
  inset-inline-start: var(--space-3);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-sm);
  background: color-mix(in oklab, black 55%, transparent);
  color: white;
  font-size: var(--text-sm);
}
</style>
