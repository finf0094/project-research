<script setup lang="ts">
import { GraduationCap } from 'lucide-vue-next'
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
    <div v-else-if="exams" class="empty-state">
      <span class="empty-icon"><GraduationCap :size="28" aria-hidden="true" /></span>
      <p>{{ $t('student.noResults') }}</p>
    </div>
    <div v-else-if="!load.error.value" class="loading" :aria-label="$t('common.loading')" role="status">
      <span v-for="n in 3" :key="n" class="skeleton" />
    </div>
  </main>
</template>

<style scoped>
.results {
  display: grid;
  gap: var(--space-5);
  max-inline-size: 720px;
}
.loading {
  display: grid;
  gap: var(--space-2);
  .skeleton {
    block-size: 64px;
    border-radius: var(--radius);
  }
}
.error {
  color: var(--danger);
}
</style>
