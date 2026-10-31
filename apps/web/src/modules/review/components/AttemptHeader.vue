<script setup lang="ts">
import type { AttemptDetail } from '@exam/contracts'
import { formatDateTime } from '@/shared/lib/format'
import { StatusPill } from '@/shared/ui'
import { STATUS_TONE } from '../labels'

/** Who, which exam, and the attempt's state at a glance. */
defineProps<{ detail: AttemptDetail }>()
</script>

<template>
  <header class="head">
    <nav class="crumbs" :aria-label="$t('hub.crumbs')">
      <RouterLink to="/examiner">{{ $t('review.exams.title') }}</RouterLink>
      <span aria-hidden="true">/</span>
      <RouterLink :to="`/examiner/exams/${detail.examId}/review`">{{ detail.examTitle }}</RouterLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ detail.summary.student.name }}</span>
    </nav>
    <h1>{{ detail.summary.student.name }}</h1>
    <div class="facts">
      <StatusPill :tone="STATUS_TONE[detail.summary.status]">{{
        $t(`review.status.${detail.summary.status}`)
      }}</StatusPill>
      <StatusPill v-if="detail.submittedAt" tone="off">{{
        $t('review.attempt.submittedAt', { at: formatDateTime(detail.submittedAt) })
      }}</StatusPill>
      <StatusPill v-if="detail.summary.riskScore !== null" tone="accent">{{
        $t('review.attempt.risk', { n: detail.summary.riskScore })
      }}</StatusPill>
      <StatusPill
        v-if="detail.serverAnalysis && detail.serverAnalysis !== 'ok'"
        tone="warn"
        :title="$t('review.attempt.uncheckedHint')"
        >{{
          $t(detail.serverAnalysis === 'partial' ? 'review.attempt.partial' : 'review.attempt.unchecked')
        }}</StatusPill
      >
    </div>
  </header>
</template>

<style scoped>
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  color: var(--text-2);
  font-size: var(--text-sm);
  a {
    color: inherit;
    &:hover {
      color: var(--text);
    }
  }
  [aria-current] {
    color: var(--text);
    font-weight: 600;
  }
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>
