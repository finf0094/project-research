<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { Link } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { countdownParts, formatDateTime } from '@/shared/lib/format'
import { AppButton } from '@/shared/ui'

/** How long until the exam opens (or closes), with the examiner's next actions. */
const props = defineProps<{ exam: ExaminerExam; now: number }>()
/** The copy result, shown on the button for a moment and announced. */
const copied = ref<'copied' | 'copyFailed' | null>(null)

const phase = computed(() =>
  props.now < props.exam.opensAt ? 'untilStart' : props.now < props.exam.closesAt ? 'untilEnd' : 'ended',
)
const left = computed(() =>
  countdownParts((phase.value === 'untilStart' ? props.exam.opensAt : props.exam.closesAt) - props.now),
)

async function copyLink() {
  // Students sign in and find the exam in their list; the link takes them straight there.
  // The clipboard may be refused (no permission, insecure context): then say so instead of failing silently.
  // (`navigator.clipboard` itself is missing over plain HTTP.)
  try {
    await navigator.clipboard.writeText(`${location.origin}/exams`)
    copied.value = 'copied'
  } catch {
    copied.value = 'copyFailed'
  }
  setTimeout(() => (copied.value = null), 2500)
}
</script>

<template>
  <section class="card">
    <p class="label">{{ $t(`hub.overview.${phase}`) }}</p>
    <p v-if="phase !== 'ended'" class="count" role="timer">
      <template v-if="left.days"
        >{{ left.days }}<small>{{ $t('hub.overview.days') }}</small> </template
      >{{ left.clock.slice(0, -2) }}<span class="seconds">{{ left.clock.slice(-2) }}</span>
    </p>
    <p class="window">
      {{
        $t('hub.overview.window', { from: formatDateTime(exam.opensAt), to: formatDateTime(exam.closesAt) })
      }}
    </p>
    <div class="actions">
      <AppButton variant="lime" icon="arrow" :to="`/examiner/exams/${exam.id}/edit`">{{
        $t('hub.overview.edit')
      }}</AppButton>
      <AppButton variant="ink" class="soft" @click="copyLink">
        <Link :size="16" aria-hidden="true" />
        <span aria-hidden="true">{{ $t(`hub.overview.${copied ?? 'copyLink'}`) }}</span>
        <span class="visually-hidden">{{ $t('hub.overview.copyLink') }}</span>
      </AppButton>
      <span class="visually-hidden" role="status">{{ copied ? $t(`hub.overview.${copied}`) : '' }}</span>
    </div>
  </section>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  gap: var(--space-3);
  overflow: hidden;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
  &::after {
    content: '';
    position: absolute;
    inset-block-start: -50%;
    inset-inline-end: -20%;
    inline-size: 360px;
    aspect-ratio: 1;
    border: 1px dashed var(--on-ink-line);
    border-radius: 50%;
  }
}
.label {
  color: var(--on-ink-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.count {
  font-family: var(--font-display);
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  small {
    margin-inline: 2px var(--space-3);
    color: var(--accent);
    font-size: 0.45em;
  }
}
.seconds {
  color: var(--lime);
}
.window {
  max-inline-size: 52ch;
  color: var(--on-ink-2);
  font-size: var(--text-sm);
}
.actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
}
.soft {
  background: var(--on-ink-tint);
}
</style>
