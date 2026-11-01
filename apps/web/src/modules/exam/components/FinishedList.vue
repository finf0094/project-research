<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { CheckCircle2, Clock } from 'lucide-vue-next'
import { IconTile } from '@/shared/ui'

/** Exams already taken: still being reviewed, or with a result to open. */
/** `titled`: the list names itself (on the home grid); the Results page has its own heading. */
withDefaults(defineProps<{ exams: StudentExamListItem[]; titled?: boolean }>(), { titled: true })
</script>

<template>
  <section class="card">
    <h2 v-if="titled">{{ $t('student.finished') }}</h2>
    <ul>
      <li v-for="exam in exams" :key="exam.id">
        <RouterLink v-if="exam.attempt?.resultReady" :to="`/attempts/${exam.attempt.id}/result`" class="row">
          <IconTile :icon="CheckCircle2" tone="ok" />
          <span>
            <span class="title">{{ exam.title }}</span>
            <span class="status ok">{{ $t('student.resultReady') }} →</span>
          </span>
        </RouterLink>
        <div v-else class="row">
          <IconTile :icon="Clock" tone="peach" />
          <span>
            <span class="title">{{ exam.title }}</span>
            <span class="status">{{
              $t(
                !exam.attempt
                  ? 'exam.list.state.closed'
                  : exam.attempt.status === 'decided'
                    ? 'student.awaitingResult'
                    : 'student.checking',
              )
            }}</span>
          </span>
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
  color: var(--text-2);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
}
ul {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
  > span {
    display: grid;
  }
}
a.row:hover {
  background: var(--surface-2);
}
.title {
  font-weight: 600;
}
.status {
  color: var(--warn);
  font-size: var(--text-xs);
  &.ok {
    color: var(--ok);
    font-weight: 700;
  }
}
</style>
