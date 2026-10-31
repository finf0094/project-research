<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Avatar, PillTabs, StatusPill } from '@/shared/ui'
import { outcome, type Outcome } from '../grade-sheet'

/** Every student's automatic points, final score, recording verdict and result; filterable and searchable. */
const props = defineProps<{ attempts: AttemptSummary[] }>()
const query = ref('')
const filter = ref<Outcome | 'all'>('all')
const shown = computed(() =>
  props.attempts.filter(
    (a) =>
      (filter.value === 'all' || outcome(a) === filter.value) &&
      a.student.name.toLowerCase().includes(query.value.trim().toLowerCase()),
  ),
)
const count = (o: Outcome) => props.attempts.filter((a) => outcome(a) === o).length
const RECORD_TONE = { clean: 'ok', violation: 'danger', needs_review: 'warn', pending: 'warn' } as const
</script>

<template>
  <section class="sheet">
    <header class="head">
      <h2>{{ $t('hub.results.ledger') }}</h2>
      <input
        v-model="query"
        type="search"
        :placeholder="$t('hub.results.search')"
        :aria-label="$t('hub.results.search')"
      />
      <PillTabs
        v-model="filter"
        :label="$t('hub.results.ledger')"
        :items="[
          { value: 'all', label: $t('hub.list.all'), count: attempts.length },
          { value: 'pass', label: $t('hub.results.verdict.pass'), count: count('pass') },
          { value: 'fail', label: $t('hub.results.verdict.fail'), count: count('fail') },
          { value: 'pending', label: $t('hub.results.verdict.pending'), count: count('pending') },
        ]"
      />
    </header>
    <div class="wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">{{ $t('hub.results.columns.student') }}</th>
            <th scope="col">{{ $t('hub.results.columns.auto') }}</th>
            <th scope="col">{{ $t('hub.results.columns.score') }}</th>
            <th scope="col">{{ $t('hub.results.columns.record') }}</th>
            <th scope="col">{{ $t('hub.results.columns.result') }}</th>
            <th scope="col">
              <span class="visually-hidden">{{ $t('review.table.actions') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in shown" :key="a.id">
            <th scope="row">
              <span class="who"><Avatar :name="a.student.name" :size="32" />{{ a.student.name }}</span>
            </th>
            <td class="num">
              {{ a.points.auto }}/{{ a.points.max
              }}<span v-if="a.points.open" class="muted" :title="$t('hub.queue.open')"
                ><span aria-hidden="true"> +</span
                ><span class="visually-hidden">{{ $t('hub.queue.open') }}</span></span
              >
            </td>
            <td>
              <span v-if="a.result?.score != null" class="score">{{ a.result.score }}</span>
              <span v-else class="muted">{{ $t('hub.results.afterReview') }}</span>
            </td>
            <td>
              <StatusPill :tone="RECORD_TONE[a.result?.verdict ?? 'pending']">{{
                $t(`hub.results.record.${a.result?.verdict ?? 'pending'}`)
              }}</StatusPill>
            </td>
            <td class="outcome" :class="outcome(a)">{{ $t(`hub.results.verdict.${outcome(a)}`) }}</td>
            <td>
              <RouterLink
                :to="`/examiner/attempts/${a.id}`"
                class="open"
                :aria-label="$t('hub.results.openAttempt', { name: a.student.name })"
              >
                <ChevronRight :size="18" />
              </RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.sheet {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  h2 {
    flex: 1;
    font-size: var(--text-lg);
  }
  input {
    min-inline-size: 200px;
    border-radius: var(--radius-pill);
  }
}
.wrap {
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
}
.who {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  font-weight: 600;
}
.num {
  font-variant-numeric: tabular-nums;
}
.score {
  display: inline-grid;
  place-items: center;
  min-inline-size: 56px;
  padding: 6px var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-family: var(--font-display);
  font-weight: 700;
}
.outcome {
  font-weight: 700;
  &.pass {
    color: var(--ok);
  }
  &.fail {
    color: var(--danger);
  }
  &.pending {
    color: var(--warn);
  }
}
.open {
  display: inline-grid;
  place-items: center;
  inline-size: 32px;
  block-size: 32px;
  border-radius: 50%;
  color: var(--text-2);
  &:hover {
    background: var(--surface-2);
  }
}
</style>
