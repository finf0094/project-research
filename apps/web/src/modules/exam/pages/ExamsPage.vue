<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AppButton } from '@/shared/ui'
import { listExams } from '../api'
import ExamCard from '../components/ExamCard.vue'
import { attemptPath } from '../paths'

const router = useRouter()
const exams = ref<StudentExamListItem[] | null>(null)
const failed = ref(false)
const now = Date.now()

async function load() {
  failed.value = false
  try {
    exams.value = await listExams()
  } catch {
    failed.value = true
  }
}
onMounted(load)
</script>

<template>
  <main class="page">
    <h1>{{ $t('exam.list.title') }}</h1>
    <p v-if="failed" class="muted">
      {{ $t('exam.list.loadFailed') }}
      <AppButton variant="ghost" @click="load">{{ $t('common.retry') }}</AppButton>
    </p>
    <p v-else-if="exams && exams.length === 0" class="muted">{{ $t('exam.list.empty') }}</p>
    <div v-else class="grid">
      <ExamCard
        v-for="exam in exams"
        :key="exam.id"
        :exam="exam"
        :now="now"
        @start="router.push(`/exams/${exam.id}/preflight`)"
        @continue="router.push(attemptPath($event, exam.mode))"
      />
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-6);
  width: min(1120px, 100%);
  margin-inline: auto;
  padding: var(--space-8) var(--space-4);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}
</style>
