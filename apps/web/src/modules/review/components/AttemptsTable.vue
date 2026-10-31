<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { ChevronRight } from 'lucide-vue-next'
import { Avatar, StatusPill } from '@/shared/ui'
import { CONNECTION_TONE, STATUS_TONE } from '../labels'

/**
 * The students of an exam, riskiest first: who they are, how far they got, network, markers and the risk
 * that orders the list. Rows glide when the order changes. `oral`: running attempts are calls to join.
 */
defineProps<{ attempts: AttemptSummary[]; oral?: boolean }>()
defineEmits<{
  act: [attempt: AttemptSummary]
  review: [attempt: AttemptSummary]
  room: [attempt: AttemptSummary]
}>()
const DONE = ['ready_for_review', 'decided']
</script>

<template>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">{{ $t('review.table.student') }}</th>
          <th scope="col">{{ $t('review.table.status') }}</th>
          <th scope="col">{{ $t('review.table.network') }}</th>
          <th scope="col" class="num">{{ $t('review.table.markers') }}</th>
          <th scope="col">{{ $t('review.table.risk') }}</th>
          <th scope="col">
            <span class="visually-hidden">{{ $t('review.table.actions') }}</span>
          </th>
        </tr>
      </thead>
      <TransitionGroup tag="tbody" name="list">
        <tr v-for="a in attempts" :key="a.id">
          <th scope="row">
            <span class="who">
              <Avatar :name="a.student.name" :size="36" />
              <span>
                <span class="name">{{ a.student.name }}</span>
                <span class="muted sub">{{ $t('review.table.answers') }}: {{ a.answered }}</span>
              </span>
            </span>
          </th>
          <td>
            <StatusPill :tone="STATUS_TONE[a.status]">{{ $t(`review.status.${a.status}`) }}</StatusPill>
          </td>
          <td>
            <span v-if="a.connection" class="net" :class="CONNECTION_TONE[a.connection]">
              <span class="dot" :class="{ live: a.connection === 'online' }" aria-hidden="true" />
              {{ $t(`review.connection.${a.connection}`) }}
            </span>
            <span v-else class="muted">—</span>
          </td>
          <td class="num">{{ a.markerCount }}</td>
          <td>
            <span v-if="a.riskScore === null" class="muted">—</span>
            <span v-else class="risk">
              <span class="bar" aria-hidden="true"><span :style="{ inlineSize: `${a.riskScore}%` }" /></span>
              <b>{{ a.riskScore }}</b>
            </span>
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
              v-else-if="DONE.includes(a.status)"
              type="button"
              class="open"
              :aria-label="`${$t('review.table.review')} ${a.student.name}`"
              @click="$emit('review', a)"
            >
              <ChevronRight :size="18" />
            </button>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<style scoped>
.wrap {
  position: relative;
  overflow-x: auto;
}
table {
  inline-size: 100%;
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
  font-size: var(--text-xs);
  font-weight: 600;
}
tbody tr {
  border-top: 1px solid var(--border);
  transition: background-color var(--dur) var(--ease);
  &:hover {
    background: var(--surface-2);
  }
}
.who {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  > span:last-child {
    display: grid;
  }
}
.name {
  font-weight: 600;
}
.sub {
  font-size: var(--text-xs);
  font-weight: 400;
}
.num {
  text-align: center;
}
.net {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  &.ok {
    color: var(--ok);
  }
  &.warn {
    color: var(--warn);
  }
  &.off {
    color: var(--text-2);
  }
}
.dot {
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: currentColor;
}
.risk {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}
/* A neutral ramp on purpose: the score orders the queue, it does not accuse anyone. */
.bar {
  display: inline-block;
  inline-size: 72px;
  block-size: 6px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, var(--warn), var(--danger));
    transition: inline-size var(--dur-slow) var(--ease);
  }
}
.actions {
  text-align: end;
}
.link {
  border: 0;
  background: none;
  color: var(--accent-ink);
  font-weight: 600;
}
.open {
  display: inline-grid;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border: 0;
  border-radius: 50%;
  background: var(--surface-2);
  transition: translate var(--dur) var(--ease);
  &:hover {
    translate: 2px 0;
  }
}
</style>
