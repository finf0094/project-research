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
    <RouterLink to="/examiner" class="crumb">{{ detail.examTitle }}</RouterLink>
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
.crumb {
  font-size: var(--text-sm);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}
</style>
