<script setup lang="ts">
import { CALIBRATION_MIN_DECISIONS, type Calibration, type CalibrationRow } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, IconTile, PageSkeleton } from '@/shared/ui'
import { getCalibration } from '../api'
import { MARKER_ICON } from '../marker-look'

/**
 * Section 25.4: how often the examiner's decisions agreed with each kind of marker, and what that does to
 * the review priority. Noisy kinds (mostly dismissed) weigh less; reliable ones keep their weight. No model is retrained.
 */
const data = ref<Calibration | null>(null)
const load = useAction()
const fetchData = () => load.run(async () => (data.value = await getCalibration()))
onMounted(fetchData)
const rows = computed(() => data.value?.kinds ?? null)
const sorted = computed(() =>
  (rows.value ?? []).toSorted((a, b) => b.confirmed + b.dismissed - (a.confirmed + a.dismissed)),
)
const share = (r: CalibrationRow) => Math.round((100 * r.confirmed) / Math.max(1, r.confirmed + r.dismissed))
const decisions = (r: CalibrationRow) => r.confirmed + r.dismissed
const effect = (r: CalibrationRow) =>
  r.factor < 1 ? 'less' : decisions(r) < CALIBRATION_MIN_DECISIONS ? 'few' : 'same'
const missRate = computed(() => {
  const c = data.value?.control
  return c && c.unmarked ? Math.round((100 * c.missed) / c.unmarked) : null
})
</script>

<template>
  <main class="page">
    <header>
      <h1>{{ $t('calibration.title') }}</h1>
      <p class="muted lead">{{ $t('calibration.lead') }}</p>
    </header>
    <p v-if="load.error.value" class="error" role="alert">
      {{ $t(load.error.value) }}
      <AppButton variant="ghost" @click="fetchData">{{ $t('common.retry') }}</AppButton>
    </p>
    <PageSkeleton v-else-if="load.busy.value" :head="false" :cards="4" />
    <p v-else-if="rows && !rows.length" class="empty">{{ $t('calibration.empty') }}</p>
    <ul v-else class="rows stagger">
      <li v-for="r in sorted" :key="r.kind" class="row">
        <IconTile :icon="MARKER_ICON[r.kind]" :tone="effect(r) === 'less' ? 'peach' : 'sky'" />
        <span class="kind">
          <b>{{ $t(`review.marker.${r.kind}`) }}</b>
          <span class="muted">{{
            $t('calibration.counts', { confirmed: r.confirmed, dismissed: r.dismissed })
          }}</span>
        </span>
        <span class="share">
          <span class="bar" aria-hidden="true"><span :style="{ inlineSize: `${share(r)}%` }" /></span>
          {{ $t('calibration.share', { n: share(r) }) }}
        </span>
        <span class="effect" :class="effect(r)">{{
          $t(`calibration.effect.${effect(r)}`, { x: r.factor })
        }}</span>
      </li>
    </ul>
    <section v-if="data" class="control">
      <h2>{{ $t('calibration.control.title') }}</h2>
      <p class="muted">{{ $t('calibration.control.text') }}</p>
      <p class="figure">
        {{
          missRate === null
            ? $t('calibration.control.none')
            : $t('calibration.control.result', {
                n: data.control.unmarked,
                m: data.control.missed,
                p: missRate,
              })
        }}
      </p>
    </section>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-5);
}
h1 {
  font-size: clamp(var(--text-2xl), 4vw, var(--text-3xl));
}
.lead {
  max-inline-size: 70ch;
}
.rows {
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
.row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(100px, 200px) auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.kind {
  display: grid;
  font-size: var(--text-sm);
}
.share {
  display: grid;
  gap: 4px;
  font-size: var(--text-xs);
  color: var(--text-2);
}
.control {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--accent-tint);
  h2 {
    font-size: var(--text-lg);
  }
}
.figure {
  font-weight: 700;
}
.bar {
  block-size: 8px;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--danger-tint);
  span {
    display: block;
    block-size: 100%;
    background: var(--ok);
    transition: inline-size var(--dur-slow) var(--ease);
  }
}
.effect {
  font-size: var(--text-sm);
  font-weight: 700;
  &.less {
    color: var(--warn);
  }
  &.few,
  &.same {
    color: var(--text-2);
  }
}
.empty {
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text-2);
}
.error {
  color: var(--danger);
}
@media (width < 640px) {
  .row {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .share,
  .effect {
    grid-column: 2;
  }
}
</style>
