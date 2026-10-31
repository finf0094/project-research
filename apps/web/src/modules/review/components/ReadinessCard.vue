<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatDateTime } from '@/shared/lib/format'
import { CheckList } from '@/shared/ui'

/** Whether the exam can run: questions, students, a valid time window, supervision. */
const props = defineProps<{ exam: ExaminerExam }>()
const { t } = useI18n()
const total = computed(
  () => props.exam.questions.single + props.exam.questions.multiple + props.exam.questions.text,
)
const items = computed(() => [
  {
    id: 'questions',
    ok: total.value > 0,
    title: t('hub.overview.questions'),
    hint: `${t('hub.count.questions', total.value)} · ${t('hub.count.points', props.exam.questions.points)}`,
  },
  {
    id: 'students',
    ok: props.exam.participants > 0,
    title: t('hub.overview.students'),
    hint: t('hub.count.participants', props.exam.participants),
  },
  {
    id: 'time',
    ok: props.exam.closesAt > props.exam.opensAt,
    title: t('hub.overview.time'),
    hint: `${formatDateTime(props.exam.opensAt)} — ${formatDateTime(props.exam.closesAt)}`,
  },
  {
    id: 'observation',
    ok: true,
    title: t('hub.overview.observation'),
    hint: t('hub.overview.observationNote'),
  },
])
const ready = computed(() => items.value.filter((i) => i.ok).length)
</script>

<template>
  <section class="card">
    <header>
      <h2>{{ $t('hub.overview.readiness') }}</h2>
      <span class="score" :class="{ ok: ready === items.length }">{{ ready }}/{{ items.length }}</span>
    </header>
    <CheckList :items="items" />
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-4);
  align-content: start;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
h2 {
  font-size: var(--text-lg);
}
.score {
  color: var(--warn);
  font-family: var(--font-display);
  font-weight: 700;
  &.ok {
    color: var(--ok);
  }
}
</style>
