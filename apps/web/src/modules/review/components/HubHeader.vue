<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { BarChart3, Eye, LayoutGrid, ShieldCheck } from 'lucide-vue-next'
import { computed } from 'vue'
import { formatDay, formatDateTime, formatTime } from '@/shared/lib/format'
import { examState, STATE_TONE } from '../exam-state'

/** Breadcrumbs, the exam's title and state, and its four sections as tabs. */
const props = defineProps<{ exam: ExaminerExam; now: number }>()
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
    <nav class="crumbs" :aria-label="$t('app.nav.label')">
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
              ? $t('hub.list.until', { at: formatTime(exam.closesAt).slice(0, 5) })
              : $t('hub.list.closedAt', { at: formatDay(exam.closesAt) })
        }}
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

<style scoped>
.head {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.crumbs {
  display: flex;
  gap: var(--space-2);
  color: var(--text-2);
  font-size: var(--text-sm);
  a {
    color: inherit;
    text-decoration: none;
    &:hover {
      color: var(--text);
    }
  }
  [aria-current] {
    color: var(--text);
    font-weight: 600;
  }
}
.title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  h1 {
    font-size: clamp(var(--text-xl), 3vw, var(--text-2xl));
  }
}
.state {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--accent-tint);
  color: var(--accent-ink);
  font-size: var(--text-xs);
  font-weight: 700;
  &.lime {
    background: var(--ink);
    color: var(--lime);
  }
  &.warn {
    background: var(--peach);
    color: var(--on-peach);
  }
  &.ok {
    background: var(--ok-tint);
    color: var(--ok);
  }
}
.dot {
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  background: currentColor;
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  justify-self: start;
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-block-size: 40px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  color: var(--text-2);
  font-size: var(--text-sm);
  font-weight: 600;
  text-decoration: none;
  transition:
    background-color var(--dur) var(--ease),
    color var(--dur) var(--ease);
  &:hover {
    color: var(--text);
  }
  &.current {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-1);
  }
}
.count {
  display: inline-grid;
  place-items: center;
  min-inline-size: 20px;
  block-size: 20px;
  border-radius: 50%;
  background: var(--danger);
  color: white;
  font-size: var(--text-xs);
}
</style>
