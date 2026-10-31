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
    <p v-else class="empty">{{ $t('review.player.empty') }}</p>
    <p v-if="sources.length > 1" class="parts">
      {{ $t('review.player.part', { n: index + 1, total: sources.length }) }}
    </p>
  </div>
</template>

<style scoped>
.player {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
}
video,
.empty {
  inline-size: 100%;
  /* A long message grows the box downwards, never wider than the screen. */
  min-block-size: 0;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius);
  background: rgb(0 0 0 / 0.35);
}
.empty {
  display: grid;
  place-items: center;
  padding: var(--space-6);
  color: var(--on-ink-2);
  text-align: center;
}
.parts {
  font-size: var(--text-xs);
  opacity: 0.7;
}
</style>
