<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { computed } from 'vue'
import { countdownParts } from '@/shared/lib/format'
import { AppButton } from '@/shared/ui'

/** The exam to take now: big, dark, with the time left and one button. */
/** `offlineReady`: the exam's package is on this device, so it can start without network. */
const props = defineProps<{ exam: StudentExamListItem; now: number; offlineReady?: boolean }>()
defineEmits<{ go: [] }>()
const running = computed(() => props.exam.attempt?.status === 'active')
const left = computed(() => countdownParts(props.exam.closesAt - props.now))
</script>

<template>
  <article class="hero">
    <div class="body">
      <span class="badge"
        ><span class="dot live" aria-hidden="true" />{{
          $t(running ? 'exam.list.state.running' : 'exam.list.state.open')
        }}</span
      >
      <h2>{{ exam.title }}</h2>
      <ul class="chips">
        <li>{{ $t(exam.mode === 'oral' ? 'student.oral' : 'student.written') }}</li>
        <li>{{ $t('exam.list.minutes', { n: exam.durationMin }, exam.durationMin) }}</li>
        <li>{{ $t('student.questions', { n: exam.questionCount }, exam.questionCount) }}</li>
        <li>{{ $t('student.camera') }}</li>
        <li v-if="offlineReady" class="offline">{{ $t('exam.offlineStart.ready') }}</li>
      </ul>
    </div>
    <div class="side">
      <p class="label">{{ $t('student.untilClose') }}</p>
      <p class="clock" role="timer">
        <template v-if="left.days"
          >{{ left.days }}<small>{{ $t('student.daysShort') }}</small> </template
        >{{ left.clock }}
      </p>
      <AppButton variant="lime" icon="arrow" @click="$emit('go')">{{
        $t(running ? 'student.continue' : 'student.start')
      }}</AppButton>
    </div>
    <span class="orb" aria-hidden="true" />
  </article>
</template>

<style scoped>
.hero {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-8);
  overflow: hidden;
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
  &::before,
  &::after {
    content: '';
    position: absolute;
    inset-block-start: -45%;
    inset-inline-end: -6%;
    inline-size: 460px;
    aspect-ratio: 1;
    border: 1px dashed var(--on-ink-tint-2);
    border-radius: 50%;
  }
  &::after {
    inset-inline-end: -14%;
    inline-size: 300px;
  }
}
/* A small accent square drifting at the edge, as on the sign-in page. */
.orb {
  position: absolute;
  inset-block-end: -18px;
  inset-inline-end: 96px;
  inline-size: 44px;
  block-size: 44px;
  border-radius: 12px;
  background: var(--accent);
  animation: drift 6s ease-in-out infinite alternate;
}
@keyframes drift {
  to {
    translate: -14px -8px;
    rotate: 8deg;
  }
}
.body,
.side {
  position: relative;
  z-index: 1;
  display: grid;
  gap: var(--space-3);
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  justify-self: start;
  padding: 4px var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--lime);
  color: var(--on-lime);
  font-size: var(--text-xs);
  font-weight: 700;
}
.dot {
  inline-size: 7px;
  block-size: 7px;
  border-radius: 50%;
  background: currentColor;
}
h2 {
  max-inline-size: 18ch;
  font-size: clamp(var(--text-xl), 3.4vw, 2.6rem);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
  li {
    padding: 6px var(--space-3);
    border-radius: var(--radius-pill);
    background: var(--on-ink-tint);
    color: var(--on-ink-2);
    font-size: var(--text-sm);
    &.offline {
      background: var(--lime);
      color: var(--on-lime);
      font-weight: 700;
    }
  }
}
.side {
  justify-items: start;
}
.label {
  color: var(--on-ink-2);
  font-size: var(--text-sm);
}
.clock {
  font-family: var(--font-display);
  font-size: clamp(2rem, 4vw, 2.75rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  small {
    margin-inline: 2px var(--space-2);
    color: var(--lime);
    font-size: 0.5em;
  }
}
/* Phones: a little less frame, and the one button spans the card, right under the thumb. */
@media (width < 700px) {
  .hero {
    gap: var(--space-6);
    padding: var(--space-6);
  }
  .body,
  .side {
    inline-size: 100%;
  }
  .side {
    justify-items: stretch;
  }
  /* The accent square moves to the top corner, clear of the full-width button. */
  .orb {
    inset-block: -18px auto;
    inset-inline-end: 40px;
  }
}
</style>
