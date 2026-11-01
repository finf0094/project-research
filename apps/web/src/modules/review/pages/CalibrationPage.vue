<script setup lang="ts">
import type { CalibrationRow } from '@exam/contracts'
import { computed, onMounted, ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { IconTile } from '@/shared/ui'
import { getCalibration } from '../api'
import { MARKER_ICON } from '../marker-look'

/**
 * Section 25.4: how often the examiner's decisions agreed with each kind of marker, and what that does to
 * the review priority. Noisy kinds (mostly dismissed) weigh less; reliable ones more. No model is retrained.
 */
const rows = ref<CalibrationRow[] | null>(null)
const load = useAction()
onMounted(() => load.run(async () => (rows.value = await getCalibration())))
const sorted = computed(() =>
  (rows.value ?? []).toSorted((a, b) => b.confirmed + b.dismissed - (a.confirmed + a.dismissed)),
)
const share = (r: CalibrationRow) => Math.round((100 * r.confirmed) / Math.max(1, r.confirmed + r.dismissed))
const effect = (factor: number) => (factor < 0.95 ? 'less' : factor > 1.05 ? 'more' : 'same')
</script>

<template>
  <main class="page">
    <header>
      <h1>{{ $t('calibration.title') }}</h1>
      <p class="muted lead">{{ $t('calibration.lead') }}</p>
    </header>
    <p v-if="load.error.value" class="error" role="alert">{{ $t(load.error.value) }}</p>
    <p v-else-if="rows && !rows.length" class="empty">{{ $t('calibration.empty') }}</p>
    <ul v-else class="rows stagger">
      <li v-for="r in sorted" :key="r.kind" class="row">
        <IconTile :icon="MARKER_ICON[r.kind]" :tone="effect(r.factor) === 'less' ? 'peach' : 'sky'" />
        <span class="kind">
          <b>{{ $t(`review.marker.${r.kind}`) }}</b>
          <span class="muted">{{
            $t('calibration.counts', { confirmed: r.confirmed, dismissed: r.dismissed })
          }}</span>
        </span>
        <span class="bar" :aria-label="$t('calibration.share', { n: share(r) })" role="img">
          <span :style="{ inlineSize: `${share(r)}%` }" />
        </span>
        <span class="effect" :class="effect(r.factor)">{{
          $t(`calibration.effect.${effect(r.factor)}`, { x: r.factor })
        }}</span>
      </li>
    </ul>
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
  &.more {
    color: var(--ok);
  }
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
  .bar,
  .effect {
    grid-column: 2;
  }
}
</style>
