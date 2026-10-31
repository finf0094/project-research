<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { StatusPill } from '@/shared/ui'
import { CONNECTION_TONE, STATUS_TONE } from '../labels'

/** `oral`: running attempts are live calls the examiner joins. */
defineProps<{ attempts: AttemptSummary[]; oral?: boolean }>()
defineEmits<{
  act: [attempt: AttemptSummary]
  review: [attempt: AttemptSummary]
  room: [attempt: AttemptSummary]
}>()
</script>

<template>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">{{ $t('review.table.student') }}</th>
          <th scope="col">{{ $t('review.table.status') }}</th>
          <th scope="col">{{ $t('review.table.network') }}</th>
          <th scope="col">{{ $t('review.table.answers') }}</th>
          <th scope="col">{{ $t('review.table.markers') }}</th>
          <th scope="col">{{ $t('review.table.risk') }}</th>
          <th scope="col">
            <span class="visually-hidden">{{ $t('review.table.actions') }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in attempts" :key="a.id">
          <th scope="row" class="name">{{ a.student.name }}</th>
          <td>
            <StatusPill :tone="STATUS_TONE[a.status]">{{ $t(`review.status.${a.status}`) }}</StatusPill>
          </td>
          <td>
            <StatusPill v-if="a.connection" :tone="CONNECTION_TONE[a.connection]" dot>
              {{ $t(`review.connection.${a.connection}`) }}
            </StatusPill>
            <span v-else class="muted">—</span>
          </td>
          <td>{{ a.answered }}</td>
          <td>{{ a.markerCount }}</td>
          <td>
            <span v-if="a.riskScore === null" class="muted">—</span>
            <span v-else class="risk"
              ><span class="bar" :style="{ inlineSize: `${a.riskScore}%` }" />{{ a.riskScore }}</span
            >
          </td>
          <td class="actions">
            <button
              v-if="oral && a.status === 'active'"
              type="button"
              class="link"
              :aria-label="$t('review.table.roomOf', { name: a.student.name })"
              @click="$emit('room', a)"
            >
              {{ $t('review.table.room') }}
            </button>
            <button
              v-if="a.status === 'active'"
              type="button"
              class="link"
              :aria-label="$t('review.table.actOf', { name: a.student.name })"
              @click="$emit('act', a)"
            >
              {{ $t('review.table.act') }}
            </button>
            <button
              v-else-if="a.status === 'ready_for_review' || a.status === 'decided'"
              type="button"
              class="link"
              @click="$emit('review', a)"
            >
              {{ $t('review.table.review') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
th,
td {
  padding: var(--space-3);
  text-align: start;
  white-space: nowrap;
}
thead th {
  color: var(--text-2);
  font-weight: 600;
}
tbody tr {
  border-top: 1px solid var(--border);
}
.name {
  font-weight: 600;
}
.risk {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-inline-size: 120px;
}
/* Neutral colour on purpose: the score orders the queue, it does not accuse anyone. */
.bar {
  display: inline-block;
  block-size: 6px;
  max-inline-size: 80px;
  border-radius: var(--radius-pill);
  background: var(--accent);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-ink);
  font-weight: 600;
}
.actions {
  text-align: end;
}
</style>
