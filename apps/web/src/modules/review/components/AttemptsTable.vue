<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { StatusPill } from '@/shared/ui'
import { CONNECTION_LABEL, STATUS_LABEL } from '../labels'

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
          <th scope="col">Студент</th>
          <th scope="col">Статус</th>
          <th scope="col">Сеть</th>
          <th scope="col">Ответы</th>
          <th scope="col">Метки</th>
          <th scope="col">Приоритет проверки</th>
          <th scope="col"><span class="visually-hidden">Действия</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in attempts" :key="a.id">
          <th scope="row" class="name">{{ a.student.name }}</th>
          <td>
            <StatusPill :tone="STATUS_LABEL[a.status].tone">{{ STATUS_LABEL[a.status].text }}</StatusPill>
          </td>
          <td>
            <StatusPill v-if="a.connection" :tone="CONNECTION_LABEL[a.connection].tone" dot>
              {{ CONNECTION_LABEL[a.connection].text }}
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
            <button v-if="oral && a.status === 'active'" type="button" class="link" @click="$emit('room', a)">
              Войти в комнату
            </button>
            <button v-if="a.status === 'active'" type="button" class="link" @click="$emit('act', a)">
              Действия
            </button>
            <button
              v-else-if="a.status === 'ready_for_review' || a.status === 'decided'"
              type="button"
              class="link"
              @click="$emit('review', a)"
            >
              Разбор →
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
