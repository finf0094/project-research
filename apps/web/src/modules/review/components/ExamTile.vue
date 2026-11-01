<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { ArrowRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { formatDateTime } from '@/shared/lib/format'
import type { ExamState } from '../exam-state'

/** An exam in the list, tinted by where it is in its life; the whole card opens the exam page. */
const props = defineProps<{ exam: ExaminerExam; state: ExamState }>()
/** Share of participants who have finished; clamped, as a removed participant may still have an attempt. */
const progress = computed(() => {
  const { participants, attempts } = props.exam
  if (!participants) return 0
  return Math.min(100, Math.round((100 * (attempts.total - attempts.active)) / participants))
})
const to = computed(() => {
  const tab = { scheduled: '', running: '/monitoring', review: '/review', finished: '/results' }[props.state]
  return `/examiner/exams/${props.exam.id}${tab}`
})
</script>

<template>
  <article class="tile" :class="state">
    <header class="top">
      <span class="badge">{{ $t(`hub.state.${state}`) }}</span>
      <span class="muted mode">{{ $t(exam.mode === 'oral' ? 'hub.list.oral' : 'hub.list.written') }}</span>
    </header>
    <h3>
      <RouterLink :to="to" class="title">{{ exam.title }}</RouterLink>
    </h3>
    <p class="muted when">
      {{ formatDateTime(exam.opensAt) }} · {{ exam.durationMin }} {{ $t('hub.overview.minutes') }}
    </p>
    <div v-if="state !== 'scheduled'" class="bar" aria-hidden="true">
      <span :style="{ inlineSize: `${progress}%` }" />
    </div>
    <span class="go" aria-hidden="true">{{ $t('hub.list.open') }} <ArrowRight :size="16" /></span>
  </article>
</template>

<style scoped>
.tile {
  position: relative;
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  transition:
    translate var(--dur) var(--ease),
    scale var(--dur-fast) var(--ease),
    box-shadow var(--dur) var(--ease);
  &:hover {
    translate: 0 -3px;
    box-shadow: var(--shadow-2);
  }
  /* The whole card is the link: it gives way under the finger. */
  &:active {
    scale: 0.98;
  }
  &:focus-within {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}
.running {
  background: var(--peach);
  color: var(--on-peach);
}
.scheduled {
  background: var(--sky);
  color: var(--on-sky);
}
.review {
  background: var(--lime-tint);
}
.finished {
  opacity: 0.85;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.badge {
  padding: 3px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-xs);
  font-weight: 700;
}
.running .badge {
  background: var(--ink);
  color: var(--lime);
}
.mode,
.when {
  font-size: var(--text-sm);
}
h3 {
  font-family: var(--font-display);
  font-size: var(--text-lg);
}
.title {
  color: inherit;
  text-decoration: none;
  /* The whole card is the link's target area. */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  &:focus-visible {
    outline: none;
  }
}
.bar {
  block-size: 6px;
  border-radius: var(--radius-pill);
  background: color-mix(in oklab, currentColor 12%, transparent);
  overflow: hidden;
  span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: currentColor;
    transition: inline-size var(--dur-slow) var(--ease);
  }
}
.go {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--accent-ink);
  font-size: var(--text-sm);
  font-weight: 700;
  transition: gap var(--dur) var(--ease);
}
.tile:hover .go {
  gap: var(--space-2);
}
</style>
