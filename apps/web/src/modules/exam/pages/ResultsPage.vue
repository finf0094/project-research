<script setup lang="ts">
import { AppButton } from '@/shared/ui'
import FinishedList from '../components/FinishedList.vue'
import { useStudentExams } from '../use-student-exams'

/** Results: the exams already taken — still being reviewed, or with a result to open. */
const { exams, load, refresh, finished } = useStudentExams()
</script>

<template>
  <main class="results stagger">
    <h1>{{ $t('app.nav.results') }}</h1>
    <p v-if="load.error.value" class="error" role="alert">
      {{ $t(load.error.value) }}
      <AppButton variant="ghost" @click="refresh">{{ $t('common.retry') }}</AppButton>
    </p>
    <FinishedList v-if="finished.length" :exams="finished" :titled="false" />
    <p v-else-if="exams" class="empty muted">{{ $t('student.noResults') }}</p>
  </main>
</template>

<style scoped>
.results {
  display: grid;
  gap: var(--space-5);
  max-inline-size: 720px;
}
.empty {
  padding: var(--space-8);
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  text-align: center;
}
.error {
  color: var(--danger);
}
</style>
