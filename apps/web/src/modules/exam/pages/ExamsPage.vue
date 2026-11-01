<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { AppButton } from '@/shared/ui'
import HomeHero from '../components/HomeHero.vue'
import UpcomingCard from '../components/UpcomingCard.vue'
import { attemptPath } from '../paths'
import { useStudentExams } from '../use-student-exams'

/** The student's home: a greeting, the exam to take now and what comes next (what is done: Results). */
const router = useRouter()
const auth = useAuthStore()
const { exams, load, now, fromCache, ready, refresh, open, upcoming, finished } = useStudentExams()
const firstName = computed(() => auth.user?.name.split(' ')[0] ?? '')

function go(exam: StudentExamListItem) {
  void router.push(exam.attempt ? attemptPath(exam.attempt.id, exam.mode) : `/exams/${exam.id}/preflight`)
}
</script>

<template>
  <main class="home">
    <header>
      <h1>{{ $t('student.hello', { name: firstName }) }}</h1>
      <p class="muted lead">
        {{ open.length ? $t('student.openNow', { n: open.length }) : $t('student.nothingOpen') }}
      </p>
    </header>
    <p v-if="load.error.value" class="error" role="alert">
      {{ $t(load.error.value) }}
      <AppButton variant="ghost" @click="refresh">{{ $t('common.retry') }}</AppButton>
    </p>

    <p v-if="fromCache" class="cached" role="status">{{ $t('student.cached') }}</p>
    <template v-if="exams">
      <div class="stagger heroes">
        <HomeHero
          v-for="exam in open"
          :key="exam.id"
          :exam="exam"
          :now="now"
          :offline-ready="ready.has(exam.id)"
          @go="go(exam)"
        />
      </div>
      <div v-if="upcoming.length" class="grid stagger">
        <UpcomingCard
          v-for="exam in upcoming"
          :key="exam.id"
          :exam="exam"
          :now="now"
          :offline-ready="ready.has(exam.id)"
        />
      </div>
      <RouterLink v-if="finished.length" to="/results" class="to-results press">
        {{ $t('student.toResults', { n: finished.length }) }} →
      </RouterLink>
      <p v-if="!exams.length" class="empty muted">{{ $t('student.empty') }}</p>
    </template>
  </main>
</template>

<style scoped>
.cached {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
  font-size: var(--text-sm);
  font-weight: 600;
}
.home,
.heroes {
  display: grid;
  gap: var(--space-6);
}
.heroes {
  gap: var(--space-4);
}
h1 {
  font-size: clamp(var(--text-2xl), 5vw, 3.5rem);
}
.lead {
  margin-top: var(--space-2);
  font-size: var(--text-lg);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
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
.to-results {
  justify-self: start;
  font-weight: 600;
}
</style>
