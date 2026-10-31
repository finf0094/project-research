<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { onMounted, ref } from 'vue'
import { formatDateTime } from '@/shared/lib/format'
import { AppCard, StatusPill } from '@/shared/ui'
import { listExams } from '../api'

const exams = ref<ExaminerExam[] | null>(null)
const failed = ref(false)
onMounted(async () => {
  try {
    exams.value = await listExams()
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <main class="page">
    <h1>{{ $t('review.exams.title') }}</h1>
    <p v-if="failed" class="muted">{{ $t('review.exams.loadFailed') }}</p>
    <ul v-else class="grid">
      <li v-for="exam in exams" :key="exam.id">
        <RouterLink :to="`/examiner/exams/${exam.id}`" class="card-link">
          <AppCard class="card">
            <h2>{{ exam.title }}</h2>
            <p class="muted">{{ formatDateTime(exam.opensAt) }} — {{ formatDateTime(exam.closesAt) }}</p>
            <div class="counts">
              <StatusPill tone="accent">{{
                $t('review.exams.writing', { n: exam.attempts.active })
              }}</StatusPill>
              <StatusPill :tone="exam.attempts.toReview ? 'warn' : 'off'">{{
                $t('review.exams.toReview', { n: exam.attempts.toReview })
              }}</StatusPill>
              <StatusPill>{{ $t('review.exams.total', { n: exam.attempts.total }) }}</StatusPill>
            </div>
          </AppCard>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-6);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: var(--space-4);
  padding: 0;
  list-style: none;
}
.card-link {
  color: inherit;
  text-decoration: none;
}
.card {
  display: grid;
  gap: var(--space-3);
  transition: transform 0.16s var(--ease);
  &:hover {
    transform: translateY(-2px);
  }
}
.counts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
