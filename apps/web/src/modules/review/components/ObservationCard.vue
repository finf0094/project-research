<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { Camera, Clock, Film, Scale } from 'lucide-vue-next'
import { IconTile } from '@/shared/ui'

/** What supervision means for this exam, in the examiner's words (the same promise the student reads). */
defineProps<{ exam: ExaminerExam }>()
const ROWS = [
  { icon: Camera, tone: 'sky', title: 'camera', note: 'cameraNote' },
  { icon: Film, tone: 'peach', title: 'reaches', note: 'reachesNote' },
  { icon: Clock, tone: 'ok', title: 'keep', note: 'keepNote' },
  { icon: Scale, tone: 'accent', title: 'decides', note: 'decidesNote' },
] as const
</script>

<template>
  <section class="card">
    <h2>{{ $t('hub.overview.observation') }}</h2>
    <span class="mode">{{
      $t(exam.recording === 'full' ? 'hub.overview.full' : 'hub.overview.adaptive')
    }}</span>
    <ul>
      <li v-for="row in ROWS" :key="row.title">
        <IconTile :icon="row.icon" :tone="row.tone" />
        <div>
          <p class="title">{{ $t(`hub.overview.${row.title}`) }}</p>
          <p class="muted note">{{ $t(`hub.overview.${row.note}`) }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-4);
  align-content: start;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
h2 {
  font-size: var(--text-lg);
}
.mode {
  justify-self: start;
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--accent-tint);
  color: var(--accent-ink);
  font-size: var(--text-xs);
  font-weight: 700;
}
ul {
  display: grid;
  gap: var(--space-4);
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  gap: var(--space-3);
}
.title {
  font-weight: 600;
}
.note {
  font-size: var(--text-sm);
}
</style>
