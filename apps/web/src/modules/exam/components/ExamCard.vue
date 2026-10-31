<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib/format'
import { AppButton, AppCard, StatusPill } from '@/shared/ui'

const props = defineProps<{ exam: StudentExamListItem; now: number }>()
defineEmits<{ start: []; continue: [attemptId: string] }>()

const state = computed(() => {
  const { attempt, opensAt, closesAt } = props.exam
  if (attempt && ['active', 'terminated'].includes(attempt.status)) return 'running'
  if (attempt) return 'done'
  if (props.now < opensAt) return 'upcoming'
  if (props.now >= closesAt) return 'closed'
  return 'open'
})
</script>

<template>
  <AppCard class="exam" :tone="state === 'open' || state === 'running' ? 'ink' : 'surface'">
    <div class="head">
      <StatusPill v-if="state === 'open'" tone="lime" dot>Открыт сейчас</StatusPill>
      <StatusPill v-else-if="state === 'running'" tone="lime" dot>Идёт</StatusPill>
      <StatusPill v-else-if="state === 'done'" tone="ok">Сдан</StatusPill>
      <StatusPill v-else-if="state === 'upcoming'" tone="accent">Скоро</StatusPill>
      <StatusPill v-else>Закрыт</StatusPill>
    </div>
    <h2>{{ exam.title }}</h2>
    <ul class="facts">
      <li>{{ exam.durationMin }} минут</li>
      <li>Вопросов: {{ exam.questionCount }}</li>
      <li>{{ formatDateTime(exam.opensAt) }} — {{ formatDateTime(exam.closesAt) }}</li>
    </ul>
    <AppButton v-if="state === 'open'" variant="lime" @click="$emit('start')">Начать →</AppButton>
    <AppButton v-else-if="state === 'running'" variant="lime" @click="$emit('continue', exam.attempt!.id)">
      Продолжить →
    </AppButton>
  </AppCard>
</template>

<style scoped>
.exam {
  display: grid;
  gap: var(--space-4);
  align-content: start;
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
  font-size: var(--text-sm);

  li {
    padding: 4px var(--space-3);
    border-radius: var(--radius-pill);
    background: color-mix(in oklab, currentColor 10%, transparent);
  }
}
.exam > :last-child {
  justify-self: start;
}
</style>
