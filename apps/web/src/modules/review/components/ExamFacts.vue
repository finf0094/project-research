<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { CircleDot, ListChecks, TextCursorInput } from 'lucide-vue-next'
import { formatDay, formatClock } from '@/shared/lib/format'

/** The exam at a glance: when, how long, what is asked, who takes it. */
defineProps<{ exam: ExaminerExam }>()
</script>

<template>
  <section class="facts stagger">
    <div class="fact sky">
      <p class="label">{{ $t('hub.overview.date') }}</p>
      <p class="value">{{ formatDay(exam.opensAt) }}</p>
      <p class="note">{{ formatClock(exam.opensAt) }} — {{ formatClock(exam.closesAt) }}</p>
    </div>
    <div class="fact peach">
      <p class="label">{{ $t('hub.overview.duration') }}</p>
      <p class="value">
        {{ exam.durationMin }}<small>{{ $t('hub.overview.minutes') }}</small>
      </p>
      <p class="note">{{ $t('hub.overview.oneAttempt') }}</p>
    </div>
    <div class="fact">
      <p class="label">{{ $t('hub.overview.questions') }}</p>
      <p class="value">{{ exam.questions.single + exam.questions.multiple + exam.questions.text }}</p>
      <p class="types">
        <span :title="$t('exam.question.type.single')"
          ><CircleDot :size="14" aria-hidden="true" /><span class="visually-hidden"
            >{{ $t('exam.question.type.single') }}:</span
          >{{ exam.questions.single }}</span
        >
        <span :title="$t('exam.question.type.multiple')"
          ><ListChecks :size="14" aria-hidden="true" /><span class="visually-hidden"
            >{{ $t('exam.question.type.multiple') }}:</span
          >{{ exam.questions.multiple }}</span
        >
        <span :title="$t('exam.question.type.text')"
          ><TextCursorInput :size="14" aria-hidden="true" /><span class="visually-hidden"
            >{{ $t('exam.question.type.text') }}:</span
          >{{ exam.questions.text }}</span
        >
      </p>
    </div>
    <div class="fact lime">
      <p class="label">{{ $t('hub.overview.studentsTile') }}</p>
      <p class="value">{{ exam.participants }}</p>
      <p class="note">{{ $t(exam.mode === 'oral' ? 'hub.list.oral' : 'hub.list.written') }}</p>
    </div>
  </section>
</template>

<style scoped>
.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}
.fact {
  display: grid;
  gap: var(--space-1);
  align-content: space-between;
  min-block-size: 140px;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.sky {
  background: var(--sky);
  color: var(--on-sky);
}
.peach {
  background: var(--peach);
  color: var(--on-peach);
}
.lime {
  background: var(--lime);
  color: var(--on-lime);
}
.label {
  font-size: var(--text-sm);
  font-weight: 600;
}
.value {
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  small {
    margin-inline-start: 4px;
    font-size: 0.5em;
  }
}
.note {
  font-size: var(--text-xs);
  opacity: 0.75;
}
.types {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    font-size: var(--text-xs);
    font-weight: 700;
  }
}
</style>
