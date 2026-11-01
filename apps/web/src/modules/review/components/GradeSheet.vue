<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { ChevronRight } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { Avatar, PillTabs, StatusPill } from '@/shared/ui'
import { outcome, type Outcome } from '../grade-sheet'
import { finalScore } from '../exam-state'

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
            <td class="num" :data-label="$t('hub.results.columns.auto')">
              <span v-if="!a.points" class="muted">—</span>
              <template v-else>{{ a.points.auto }}/{{ a.points.max }}</template
              ><span v-if="a.points?.open" class="muted" :title="$t('hub.queue.open')"
                ><span aria-hidden="true"> +</span
                ><span class="visually-hidden">{{ $t('hub.queue.open') }}</span></span
              >
            </td>
            <td :data-label="$t('hub.results.columns.score')">
              <span v-if="finalScore(a) !== null" class="score">{{ finalScore(a) }}</span>
              <span v-else class="muted">{{ $t('hub.results.afterReview') }}</span>
            </td>
            <td :data-label="$t('hub.results.columns.record')">
              <StatusPill :tone="RECORD_TONE[a.result?.verdict ?? 'pending']">{{
                $t(`hub.results.record.${a.result?.verdict ?? 'pending'}`)
              }}</StatusPill>
            </td>
            <td class="outcome" :class="outcome(a)" :data-label="$t('hub.results.columns.result')">
              {{ $t(`hub.results.verdict.${outcome(a)}`) }}
            </td>
            <td class="actions">
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

<style scoped src="./grade-sheet.css"></style>
