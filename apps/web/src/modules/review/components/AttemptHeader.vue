<script setup lang="ts">
import type { AttemptDetail } from '@exam/contracts'
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { formatClock } from '@/shared/lib/format'
import { StatusPill } from '@/shared/ui'
import { STATUS_TONE } from '../labels'
import type { QueuePlace } from '../review-queue'

/** Who, where in the queue, the attempt's state at a glance, and the way back to the queue or on to the next. */
defineProps<{ detail: AttemptDetail; queue: QueuePlace | null }>()
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
    <div class="row">
      <RouterLink
        :to="`/examiner/exams/${detail.examId}/review`"
        class="back"
        :aria-label="$t('review.attempt.backToQueue')"
        ><ArrowLeft :size="20"
      /></RouterLink>
      <h1>{{ detail.summary.student.name }}</h1>
      <span v-if="queue?.position" class="muted place">{{
        $t('review.attempt.place', { n: queue.position, total: queue.total })
      }}</span>
      <div class="facts">
        <StatusPill :tone="STATUS_TONE[detail.summary.status]">{{
          $t(`review.status.${detail.summary.status}`)
        }}</StatusPill>
        <StatusPill v-if="detail.submittedAt" tone="ok">{{
          $t('review.attempt.submittedAt', { at: formatClock(detail.submittedAt) })
        }}</StatusPill>
        <StatusPill v-if="detail.summary.riskScore !== null" tone="danger">{{
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
      <RouterLink v-if="queue?.next" :to="`/examiner/attempts/${queue.next.id}`" class="next">
        {{ $t('review.attempt.next', { name: queue.next.name }) }}
        <span class="chip" aria-hidden="true"><ArrowRight :size="16" /></span>
      </RouterLink>
    </div>
  </header>
</template>

<style scoped>
.head {
  display: grid;
  gap: var(--space-3);
}
.crumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  h1 {
    font-size: clamp(var(--text-xl), 3vw, var(--text-2xl));
  }
}
.back,
.chip {
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
}
.back {
  inline-size: 44px;
  block-size: 44px;
  background: var(--surface);
  box-shadow: var(--shadow-1);
  color: var(--text);
  transition: translate var(--dur-fast) var(--ease);
  &:hover {
    translate: -2px 0;
  }
}
.place {
  font-size: var(--text-sm);
}
.facts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.next {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  margin-inline-start: auto;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 700;
  text-decoration: none;
  .chip {
    inline-size: 32px;
    block-size: 32px;
    background: var(--ink);
    color: var(--on-ink);
    transition: translate var(--dur-fast) var(--ease);
  }
  &:hover .chip {
    translate: 2px 0;
  }
}
</style>
