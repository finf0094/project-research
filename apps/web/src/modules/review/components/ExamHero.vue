<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { formatClock } from '@/shared/lib/format'
import { AppButton } from '@/shared/ui'

/** The exam running right now, large and dark, with the two places a proctor goes: monitoring and review. */
defineProps<{ exam: ExaminerExam }>()
</script>

<template>
  <article class="hero">
    <div class="body">
      <span class="badge"
        ><span class="dot live" />{{ $t('hub.state.running') }} ·
        {{ $t('hub.list.until', { at: formatClock(exam.closesAt) }) }}</span
      >
      <h2>{{ exam.title }}</h2>
      <ul class="facts">
        <li>
          <b>{{ exam.attempts.active }}</b> {{ $t('hub.list.writing') }}
        </li>
        <li>
          <b>{{ exam.participants }}</b> {{ $t('hub.list.participants', exam.participants) }}
        </li>
        <li>
          <b>{{ exam.attempts.toReview }}</b> {{ $t('hub.list.toReview') }}
        </li>
      </ul>
    </div>
    <div class="actions">
      <AppButton variant="lime" icon="arrow" :to="`/examiner/exams/${exam.id}/monitoring`">{{
        $t('hub.list.monitoring')
      }}</AppButton>
      <AppButton variant="ink" class="soft" :to="`/examiner/exams/${exam.id}/review`">
        {{ $t('hub.list.review') }}
        <span v-if="exam.attempts.toReview" class="count">{{ exam.attempts.toReview }}</span>
      </AppButton>
    </div>
  </article>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-6);
  overflow: hidden;
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
  /* Two faint orbits, as on the sign-in page. */
  &::before {
    content: '';
    position: absolute;
    inset-block-start: -40%;
    inset-inline-end: -8%;
    inline-size: 420px;
    aspect-ratio: 1;
    border: 1px dashed var(--on-ink-line);
    border-radius: 50%;
  }
}
.body {
  display: grid;
  gap: var(--space-3);
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: start;
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--lime);
  color: var(--on-lime);
  font-size: var(--text-xs);
  font-weight: 700;
}
.dot {
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  background: currentColor;
}
h2 {
  font-size: var(--text-2xl);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
  li {
    padding: 6px var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--on-ink-tint);
    color: var(--on-ink-2);
    font-size: var(--text-sm);
  }
  b {
    color: var(--on-ink);
    font-family: var(--font-display);
  }
}
.actions {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.soft {
  background: var(--on-ink-tint);
}
.count {
  display: inline-grid;
  place-items: center;
  min-inline-size: 22px;
  block-size: 22px;
  border-radius: 50%;
  background: var(--danger);
  color: var(--on-danger);
  font-size: var(--text-xs);
}
</style>
