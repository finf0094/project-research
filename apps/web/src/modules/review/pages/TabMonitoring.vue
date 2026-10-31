<script setup lang="ts">
import type { AttemptSummary, ExaminerCommandBody } from '@exam/contracts'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppCard, PillTabs, StatTile } from '@/shared/ui'
import { alertsBetween, type Alert } from '../alerts'
import { sendCommand } from '../api'
import AlertsFeed from '../components/AlertsFeed.vue'
import AttemptsTable from '../components/AttemptsTable.vue'
import CommandDialog from '../components/CommandDialog.vue'
import { useExamHub } from '../exam-hub'

/** The exam while it runs: counts, the students riskiest first, and a feed of what needs attention. */
defineProps<{ now: number }>()
const { exam, attempts, refresh } = useExamHub()
const router = useRouter()

type Filter = 'all' | 'writing' | 'problems' | 'submitted'
const filter = ref<Filter>('all')
const MATCH: Record<Filter, (a: AttemptSummary) => boolean> = {
  all: () => true,
  writing: (a) => a.status === 'active',
  problems: (a) => a.connection === 'offline' || a.connection === 'slow',
  submitted: (a) => !['active', 'terminated'].includes(a.status),
}
const shown = computed(() => attempts.value.filter(MATCH[filter.value]))
const count = (f: Filter) => attempts.value.filter(MATCH[f]).length
const filters = computed(() =>
  (['all', 'writing', 'problems', 'submitted'] as const).map((value) => ({
    value,
    label: value === 'all' ? 'hub.list.all' : `hub.monitoring.${value}`,
    count: count(value),
  })),
)

// The feed remembers the last 30 alerts of this visit; each refresh adds what changed since the previous.
const alerts = ref<Alert[]>([])
watch(attempts, (next, previous) => {
  if (previous.length)
    alerts.value = [...alertsBetween(previous, next, Date.now()).reverse(), ...alerts.value].slice(0, 30)
})

const acting = ref<AttemptSummary | null>(null)
const action = useAction({ 409: 'review.notRunning' as const })
watch(acting, () => (action.error.value = null))
async function send(body: ExaminerCommandBody) {
  const target = acting.value
  if (!target || action.busy.value) return
  const sent = await action.run(() => sendCommand(target.id, body))
  // The examiner may have moved on to another student meanwhile: the result belongs to this one only.
  if (acting.value?.id !== target.id) action.error.value = null
  else if (sent) acting.value = null
  await refresh()
}
const openAttempt = (id: string) => router.push(`/examiner/attempts/${id}`)
</script>

<template>
  <div v-if="exam" class="monitoring">
    <section class="stats stagger" :aria-label="$t('review.monitoring.summary')">
      <StatTile
        :label="$t('review.monitoring.writing')"
        :value="exam.attempts.active"
        :note="$t('hub.monitoring.ofParticipants', { n: exam.participants })"
      />
      <StatTile
        :label="$t('review.monitoring.offline')"
        :value="count('problems')"
        :note="$t('review.monitoring.offlineNote')"
        tone="ink"
      />
      <StatTile :label="$t('review.monitoring.submitted')" :value="count('submitted')" tone="sky" />
      <StatTile
        :label="$t('hub.monitoring.withMarkers')"
        :value="attempts.filter((a) => a.markerCount > 0).length"
        :note="$t('hub.monitoring.withMarkersNote')"
        tone="peach"
      />
    </section>

    <div class="layout">
      <AppCard class="students">
        <header class="head">
          <h2>{{ $t('review.monitoring.students') }}</h2>
          <p class="muted note">{{ $t('review.monitoring.riskNote') }}</p>
        </header>
        <PillTabs
          v-model="filter"
          :label="$t('hub.monitoring.filter')"
          :items="filters.map((f) => ({ ...f, label: $t(f.label) }))"
        />
        <AttemptsTable
          :attempts="shown"
          :oral="exam.mode === 'oral'"
          @act="acting = $event"
          @room="router.push(`/examiner/attempts/${$event.id}/room`)"
          @review="openAttempt($event.id)"
        />
      </AppCard>
      <AlertsFeed :alerts="alerts" :now="now" @open="openAttempt" />
    </div>

    <CommandDialog
      :attempt="acting"
      :sending="action.busy.value"
      :error="action.error.value"
      @send="send"
      @close="acting = null"
    />
  </div>
</template>

<style scoped>
.monitoring {
  display: grid;
  gap: var(--space-4);
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--space-4);
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: var(--space-4);
  align-items: start;
}
.students {
  display: grid;
  gap: var(--space-4);
}
.head h2 {
  font-size: var(--text-lg);
}
.note {
  font-size: var(--text-sm);
}
@media (width < 1100px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
