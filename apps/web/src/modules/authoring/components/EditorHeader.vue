<script setup lang="ts" generic="S extends string">
import { PillTabs } from '@/shared/ui'

/** The editor's head: where it is, the exam's name with its size, and the steps to move between. */
defineProps<{
  examId: string | null
  title: string
  count: number | null
  points: number
  steps: { value: S; label: string; count?: number }[]
}>()
const step = defineModel<S>('step', { required: true })
</script>

<template>
  <header class="head">
    <nav class="crumbs" :aria-label="$t('hub.crumbs')">
      <RouterLink to="/examiner">{{ $t('review.exams.title') }}</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink v-if="examId" :to="`/examiner/exams/${examId}`">{{
        title || $t('authoring.editTitle')
      }}</RouterLink>
      <span v-else aria-current="page">{{ $t('authoring.newTitle') }}</span>
    </nav>
    <div class="title">
      <h1>{{ title || (examId ? $t('authoring.editTitle') : $t('authoring.newTitle')) }}</h1>
      <span v-if="count !== null" class="summary">{{ $t('authoring.summary', { n: count, points }) }}</span>
    </div>
    <PillTabs v-if="count !== null" v-model="step" :items="steps" :label="$t('authoring.steps.label')" />
  </header>
</template>

<style scoped>
.head {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  color: var(--text-2);
  font-size: var(--text-sm);
  a {
    color: inherit;
  }
  [aria-current] {
    color: var(--text);
    font-weight: 600;
  }
}
.title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  h1 {
    font-size: clamp(var(--text-xl), 3vw, var(--text-2xl));
  }
}
.summary {
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  font-size: var(--text-xs);
  font-weight: 700;
}
</style>
