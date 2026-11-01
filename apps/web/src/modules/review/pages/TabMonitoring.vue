<script setup lang="ts">
import type { AttemptSummary, ExaminerCommandBody } from '@exam/contracts'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { errorKey, type ErrorKey } from '@/shared/lib/error-key'
import { AppCard, PillTabs, StatTile } from '@/shared/ui'
import { sendCommand } from '../api'
import AlertsFeed from '../components/AlertsFeed.vue'
import AttemptsTable from '../components/AttemptsTable.vue'
import CommandDialog from '../components/CommandDialog.vue'
import { useExamHub } from '../exam-hub'

/** The exam while it runs: counts, the students riskiest first, and a feed of what needs attention. */
const { exam, attempts, alerts, now, refresh } = useExamHub()
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

const acting = ref<AttemptSummary | null>(null)
// Kept per student: a command to one student must not wait for, or be dropped by, one still on its way to
// another. The same student gets no second command until the first is answered.
const sending = ref(new Set<string>())
const failed = ref(new Map<string, ErrorKey | 'review.notRunning'>())
// A dialog opens without the failure of an earlier try.
watch(acting, (attempt) => attempt && failed.value.delete(attempt.id))
async function send(body: ExaminerCommandBody) {
  const target = acting.value
  if (!target || sending.value.has(target.id)) return
  sending.value.add(target.id)
  failed.value.delete(target.id)
  try {
    await sendCommand(target.id, body)
    if (acting.value?.id === target.id) acting.value = null
  } catch (error) {
    // Shown only while that student's dialog is open; the examiner may have moved on meanwhile.
    if (acting.value?.id === target.id)
      failed.value.set(target.id, errorKey(error, { 409: 'review.notRunning' }))
  } finally {
    sending.value.delete(target.id)
  }
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
        :note="$t('hub.monitoring.ofParticipants', exam.participants)"
      />
      <StatTile
        :label="$t('review.monitoring.offline')"
        :value="attempts.filter((a) => a.connection === 'offline').length"
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
      :sending="!!acting && sending.has(acting.id)"
      :error="(acting && failed.get(acting.id)) ?? null"
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
