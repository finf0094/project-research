<script setup lang="ts">
import { computed, ref } from 'vue'
import { AppButton, AppCard, CountUp, PillTabs, StatTile } from '@/shared/ui'
import QueueRow from '../components/QueueRow.vue'
import { useExamHub } from '../exam-hub'

/** Human review, riskiest first: how far it is, and the queue to work through. */
defineProps<{ now: number }>()
const { attempts } = useExamHub()

type Filter = 'ready_for_review' | 'submitted' | 'decided'
const filter = ref<Filter>('ready_for_review')
const of = (status: Filter) => attempts.value.filter((a) => a.status === status)
const finished = computed(
  () => attempts.value.filter((a) => !['active', 'terminated'].includes(a.status)).length,
)
const checked = computed(() => of('decided').length)
const first = computed(() => of('ready_for_review')[0] ?? null)
const filters = computed(() => [
  { value: 'ready_for_review' as const, label: 'hub.queue.waiting', count: of('ready_for_review').length },
  { value: 'submitted' as const, label: 'hub.queue.analysing', count: of('submitted').length },
  { value: 'decided' as const, label: 'review.status.decided', count: checked.value },
])
</script>

<template>
  <div class="review">
    <div class="top">
      <section class="progress">
        <div>
          <p class="label">{{ $t('hub.queue.checked') }}</p>
          <p class="count">
            <CountUp :value="checked" /><span>/{{ finished }}</span>
          </p>
        </div>
        <div class="middle">
          <div class="bar" aria-hidden="true">
            <span :style="{ inlineSize: `${finished ? (100 * checked) / finished : 0}%` }" />
          </div>
          <p class="hint">{{ $t('hub.queue.hint') }}</p>
        </div>
        <AppButton v-if="first" variant="lime" icon="arrow" :to="`/examiner/attempts/${first.id}`">
          {{ $t('hub.queue.start') }}
        </AppButton>
      </section>
      <StatTile :label="$t('hub.queue.waiting')" :value="of('ready_for_review').length" tone="peach" />
      <StatTile :label="$t('hub.queue.analysing')" :value="of('submitted').length" tone="sky" />
    </div>

    <AppCard class="queue">
      <header class="head">
        <h2>{{ $t('hub.queue.title') }}</h2>
        <PillTabs
          v-model="filter"
          :label="$t('hub.queue.filter')"
          :items="filters.map((f) => ({ ...f, label: $t(f.label) }))"
        />
      </header>
      <p v-if="!of(filter).length" class="muted empty">{{ $t('hub.queue.empty') }}</p>
      <TransitionGroup tag="div" name="list" class="rows">
        <QueueRow v-for="a in of(filter)" :key="a.id" :attempt="a" />
      </TransitionGroup>
    </AppCard>
  </div>
</template>

<style scoped>
.review {
  display: grid;
  gap: var(--space-4);
}
.top {
  display: grid;
  grid-template-columns: minmax(0, 2.4fr) repeat(2, minmax(140px, 0.7fr));
  gap: var(--space-4);
}
.progress {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
.label {
  color: var(--on-ink-2);
  font-size: var(--text-sm);
}
.count {
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: 700;
  line-height: 1;
  span {
    color: var(--on-ink-2);
  }
}
.middle {
  display: grid;
  flex: 1 1 200px;
  gap: var(--space-2);
}
.bar {
  block-size: 8px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: rgb(255 255 255 / 0.12);
  span {
    display: block;
    block-size: 100%;
    border-radius: inherit;
    background: var(--lime);
    transition: inline-size var(--dur-slow) var(--ease);
  }
}
.hint {
  color: var(--on-ink-2);
  font-size: var(--text-xs);
}
.queue {
  display: grid;
  gap: var(--space-3);
}
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-lg);
  }
}
.rows {
  position: relative;
  display: grid;
}
.empty {
  padding: var(--space-6);
  text-align: center;
}
@media (width < 1000px) {
  .top {
    grid-template-columns: 1fr 1fr;
  }
  .progress {
    grid-column: 1 / -1;
  }
}
</style>
