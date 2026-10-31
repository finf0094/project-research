<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{ sources: string[] }>()
const index = ref(0)
const video = ref<HTMLVideoElement>()
const src = computed(() => props.sources[index.value])

// Each recorded chunk is a standalone file; they play back to back.
watch(
  () => props.sources,
  () => (index.value = 0),
)
function next() {
  if (index.value < props.sources.length - 1) {
    index.value++
    requestAnimationFrame(() => void video.value?.play())
  }
}
</script>

<template>
  <div class="player">
    <video v-if="src" ref="video" :src="src" controls preload="metadata" @ended="next" />
    <p v-else class="empty">Для этой метки нет записи. Решение — по журналу событий.</p>
    <p v-if="sources.length > 1" class="muted parts">Часть {{ index + 1 }} из {{ sources.length }}</p>
  </div>
</template>

<style scoped>
.player {
  display: grid;
  gap: var(--space-2);
}
video,
.empty {
  inline-size: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  background: var(--ink);
}
.empty {
  display: grid;
  place-items: center;
  padding: var(--space-6);
  color: rgb(255 255 255 / 0.7);
  text-align: center;
}
.parts {
  font-size: var(--text-xs);
}
</style>
