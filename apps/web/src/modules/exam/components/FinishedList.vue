<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { CheckCircle2, ChevronRight, Clock } from 'lucide-vue-next'
import { IconTile } from '@/shared/ui'

/**
 * Exams already taken, as a native list: still being reviewed, or with a result to open (a row with a chevron).
 * `titled`: the list names itself; the Results page has its own heading.
 */
withDefaults(defineProps<{ exams: StudentExamListItem[]; titled?: boolean }>(), { titled: true })
</script>

<template>
  <section class="finished">
    <h2 v-if="titled">{{ $t('student.finished') }}</h2>
    <ul class="list-group stagger">
      <li v-for="exam in exams" :key="exam.id">
        <RouterLink
          v-if="exam.attempt?.resultReady"
          :to="`/attempts/${exam.attempt.id}/result`"
          class="list-row"
        >
          <IconTile :icon="CheckCircle2" tone="ok" />
          <span class="list-row-text">
            <span>{{ exam.title }}</span>
            <span class="status ok">{{ $t('student.resultReady') }}</span>
          </span>
          <ChevronRight :size="18" class="chevron" aria-hidden="true" />
        </RouterLink>
        <div v-else class="list-row">
          <IconTile :icon="Clock" tone="peach" />
          <span class="list-row-text">
            <span>{{ exam.title }}</span>
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
.finished {
  display: grid;
  gap: var(--space-2);
}
h2 {
  padding-inline: var(--space-4);
  color: var(--text-2);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
}
.status {
  /* Beats the list's grey second line: the state is the point of the row. */
  &.status {
    color: var(--warn);
    font-size: var(--text-xs);
    font-weight: 600;
  }
  &.ok {
    color: var(--ok);
  }
}
</style>
