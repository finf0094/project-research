<script setup lang="ts">
import type { ExaminerExam } from '@exam/contracts'
import { FolderPlus } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, PillTabs } from '@/shared/ui'
import { listExams } from '../api'
import ExamHero from '../components/ExamHero.vue'
import ExamTile from '../components/ExamTile.vue'
import { examState, type ExamState } from '../exam-state'

/** The examiner's home: the exam running now on top, every other exam as a card, filtered by state. */
const exams = ref<ExaminerExam[] | null>(null)
const filter = ref<ExamState | 'all'>('all')
const load = useAction()
// Ticks, so a scheduled exam turns into the running one while the page stays open.
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 30_000)
onUnmounted(() => clearInterval(clock))
const fetchExams = () => load.run(async () => (exams.value = await listExams()))
onMounted(fetchExams)

const withState = computed(() =>
  (exams.value ?? []).map((exam) => ({ exam, state: examState(exam, now.value) })),
)
const count = (state: ExamState) => withState.value.filter((e) => e.state === state).length
const hero = computed(() => withState.value.find((e) => e.state === 'running')?.exam ?? null)
const cards = computed(() =>
  withState.value.filter(
    (e) => e.exam !== hero.value && (filter.value === 'all' || e.state === filter.value),
  ),
)
const filters = computed(() => [
  { value: 'all' as const, label: 'hub.list.all', count: withState.value.length },
  ...(['running', 'review', 'scheduled', 'finished'] as const).map((state) => ({
    value: state,
    label: `hub.state.${state}`,
    count: count(state),
  })),
])
</script>

<template>
  <main class="page">
    <header class="head">
      <div>
        <h1>{{ $t('review.exams.title') }}</h1>
        <p v-if="exams" class="muted">
          {{ $t('hub.list.subtitle', { running: count('running'), review: count('review') }) }}
        </p>
      </div>
      <AppButton icon="plus" to="/examiner/exams/new">{{ $t('review.exams.create') }}</AppButton>
    </header>
    <p v-if="load.error.value" class="error" role="alert">
      {{ $t(load.error.value) }}
      <AppButton variant="ghost" @click="fetchExams">{{ $t('common.retry') }}</AppButton>
    </p>

    <template v-if="exams">
      <PillTabs
        v-model="filter"
        :label="$t('hub.list.filter')"
        :items="filters.map((f) => ({ ...f, label: $t(f.label) }))"
      />
      <ExamHero v-if="hero && (filter === 'all' || filter === 'running')" :exam="hero" />
      <div v-if="!exams.length" class="empty-state">
        <span class="empty-icon"><FolderPlus :size="28" aria-hidden="true" /></span>
        <p>{{ $t('hub.list.empty') }}</p>
      </div>
      <div class="grid stagger">
        <ExamTile v-for="{ exam, state } in cards" :key="exam.id" :exam="exam" :state="state" />
      </div>
    </template>
    <div v-else-if="!load.error.value" class="loading" role="status" :aria-label="$t('common.loading')">
      <span class="skeleton pills" />
      <span class="skeleton hero" />
      <div class="grid">
        <span v-for="n in 3" :key="n" class="skeleton tile" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-6);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-4);
}
.loading {
  display: grid;
  gap: var(--space-6);
  .pills {
    block-size: 52px;
    max-inline-size: 520px;
    border-radius: var(--radius-pill);
  }
  .hero {
    block-size: 300px;
  }
  .tile {
    block-size: 200px;
  }
}
/* Phones: the main action spans the width, like an app's primary button. */
@media (width < 700px) {
  .head > :last-child {
    inline-size: 100%;
  }
}
.error {
  color: var(--danger);
}
</style>
