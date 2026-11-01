<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { BarChart3, Eye, LayoutGrid, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'
import { formatDay, formatDateTime, formatClock } from '@/shared/lib/format'
import { examState, STATE_TONE } from '../exam-state'

/**
 * Breadcrumbs, the exam's title and state, whether the numbers are live, and its four sections as tabs.
 * `live`: the stream is connected; `stale`: the last reload failed.
 */
const props = defineProps<{ exam: ExaminerExam; now: number; live: boolean; stale: boolean }>()
const sync = computed(() => (props.stale ? 'stale' : props.live ? 'live' : 'polling'))
const state = computed(() => examState(props.exam, props.now))
const base = computed(() => `/examiner/exams/${props.exam.id}`)
const TABS = [
  { path: '', label: 'hub.tabs.overview', icon: LayoutGrid },
  { path: '/monitoring', label: 'hub.tabs.monitoring', icon: Eye },
  { path: '/review', label: 'hub.tabs.review', icon: ShieldCheck },
  { path: '/results', label: 'hub.tabs.results', icon: BarChart3 },
]
</script>

<template>
  <header class="head">
    <nav class="crumbs" :aria-label="$t('hub.crumbs')">
      <RouterLink to="/examiner">{{ $t('review.exams.title') }}</RouterLink>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{{ exam.title }}</span>
    </nav>
    <div class="title">
      <h1>{{ exam.title }}</h1>
      <span class="state" :class="STATE_TONE[state]">
        <span v-if="state === 'running'" class="dot live" aria-hidden="true" />
        {{ $t(`hub.state.${state}`) }} ·
        {{
          state === 'scheduled'
            ? $t('hub.list.startsAt', { at: formatDateTime(exam.opensAt) })
            : state === 'running'
              ? $t('hub.list.until', { at: formatClock(exam.closesAt) })
              : $t('hub.list.closedAt', { at: formatDay(exam.closesAt) })
        }}
      </span>
      <span class="sync" :class="`is-${sync}`" role="status">
        <span class="dot" :class="{ live: sync === 'live' }" aria-hidden="true" />
        {{ $t(`hub.sync.${sync}`) }}
      </span>
    </div>
    <nav class="tabs" :aria-label="$t('hub.tabs.label')">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.path"
        :to="base + tab.path"
        class="tab"
        exact-active-class="current"
      >
        <component :is="tab.icon" :size="16" aria-hidden="true" />
        {{ $t(tab.label) }}
        <span v-if="tab.path === '/review' && exam.attempts.toReview" class="count">{{
          exam.attempts.toReview
        }}</span>
      </RouterLink>
    </nav>
  </header>
</template>

<style scoped src="./hub-header.css"></style>
