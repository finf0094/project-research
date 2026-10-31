<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { ChevronRight } from 'lucide-vue-next'
import { StatusPill } from '@/shared/ui'
import { riskLevel, STATUS_TONE } from '../labels'

/** One attempt in the review queue: its risk, what was noticed, the automatic points, its state. */
defineProps<{ attempt: AttemptSummary }>()
</script>

<template>
  <RouterLink :to="`/examiner/attempts/${attempt.id}`" class="row">
    <span class="risk" :class="riskLevel(attempt.riskScore)">{{ attempt.riskScore ?? '—' }}</span>
    <span class="main">
      <span class="name">{{ attempt.student.name }}</span>
      <span class="chips">
        <span v-for="m in attempt.topMarkers" :key="m.kind" class="chip">
          {{ $t(`review.marker.${m.kind}`) }}<template v-if="m.count > 1"> ×{{ m.count }}</template>
        </span>
      </span>
    </span>
    <span class="points">
      <span class="muted label">{{ $t('hub.queue.auto') }}</span>
      <b>{{ attempt.points.auto }} / {{ attempt.points.max }}</b>
      <span v-if="attempt.points.open" class="muted"> {{ $t('hub.queue.open') }}</span>
    </span>
    <StatusPill :tone="STATUS_TONE[attempt.status]">{{ $t(`review.status.${attempt.status}`) }}</StatusPill>
    <ChevronRight class="go" :size="18" aria-hidden="true" />
  </RouterLink>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3);
  border-radius: var(--radius);
  color: inherit;
  text-decoration: none;
  transition: background-color var(--dur) var(--ease);
  &:hover {
    background: var(--surface-2);
    .go {
      translate: 3px 0;
    }
  }
}
.risk {
  display: grid;
  place-items: center;
  inline-size: 48px;
  block-size: 48px;
  border-radius: var(--radius);
  font-family: var(--font-display);
  font-weight: 700;
  &.high {
    background: var(--danger-tint);
    color: var(--danger);
  }
  &.mid {
    background: var(--peach);
    color: var(--on-peach);
  }
  &.low,
  &.none {
    background: var(--surface-2);
    color: var(--text-2);
  }
}
.main {
  display: grid;
  gap: var(--space-1);
}
.name {
  font-weight: 700;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}
.chip {
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--peach);
  color: var(--on-peach);
  font-size: var(--text-xs);
  font-weight: 600;
}
.points {
  display: grid;
  text-align: end;
  font-size: var(--text-sm);
  .label {
    font-size: var(--text-xs);
  }
  b {
    font-family: var(--font-display);
  }
}
.go {
  color: var(--text-2);
  transition: translate var(--dur) var(--ease);
}
@media (width < 700px) {
  .row {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .points,
  .go {
    display: none;
  }
}
</style>
