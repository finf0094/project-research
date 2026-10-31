<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib/format'
import { timeLeft } from '../time-left'

/** An exam that opens later: how soon, big; oral ones peach, written ones sky. */
const props = defineProps<{ exam: StudentExamListItem; now: number }>()
const left = computed(() => timeLeft(props.exam.opensAt - props.now))
</script>

<template>
  <article class="card" :class="exam.mode">
    <p class="mode">{{ $t(exam.mode === 'oral' ? 'student.oral' : 'student.written') }}</p>
    <p class="when">{{ $t(`student.${left.unit}`, { n: left.n }, left.n) }}</p>
    <h3>{{ exam.title }}</h3>
    <p class="meta">
      {{ formatDateTime(exam.opensAt) }} ·
      {{ $t('exam.list.minutes', { n: exam.durationMin }, exam.durationMin) }}
    </p>
  </article>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  transition: translate var(--dur) var(--ease);
  &:hover {
    translate: 0 -3px;
  }
}
.oral {
  background: var(--peach);
  color: var(--on-peach);
}
.written {
  background: var(--sky);
  color: var(--on-sky);
}
.mode {
  font-size: var(--text-sm);
  font-weight: 600;
}
.when {
  margin-block: var(--space-3) var(--space-1);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
}
h3 {
  font-size: var(--text-md);
  font-weight: 600;
}
.meta {
  font-size: var(--text-xs);
  opacity: 0.75;
}
</style>
