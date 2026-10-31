<script setup lang="ts">
import type { Marker } from '@exam/contracts'
import { computed } from 'vue'
import { CountUp } from '@/shared/ui'

/** How far the examiner is through the markers: confirmed, dismissed, still to look at. */
const props = defineProps<{ markers: Marker[] }>()
const counts = computed(() => {
  const of = (status: Marker['status']) => props.markers.filter((m) => m.status === status).length
  return { confirmed: of('confirmed'), dismissed: of('dismissed'), pending: of('pending') }
})
</script>

<template>
  <section class="summary">
    <h2>{{ $t('review.summary.title') }}</h2>
    <dl class="counts">
      <div v-for="(n, key) in counts" :key="key" :class="key">
        <dt>{{ $t(`review.summary.${key}`) }}</dt>
        <dd><CountUp :value="n" /></dd>
      </div>
    </dl>
    <p class="note">{{ $t('review.attempt.markersNote') }}</p>
  </section>
</template>

<style scoped>
.summary {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--peach);
  color: var(--on-peach);
}
h2 {
  font-size: var(--text-lg);
}
.counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
  margin: 0;
  div {
    display: flex;
    flex-direction: column-reverse;
    gap: 2px;
    padding: var(--space-3);
    border-radius: var(--radius);
    background: color-mix(in oklab, var(--surface) 65%, transparent);
  }
  dd {
    margin: 0;
    font-family: var(--font-display);
    font-size: var(--text-2xl);
    font-weight: 700;
    line-height: 1;
  }
  dt {
    font-size: var(--text-xs);
  }
  .pending dd {
    color: var(--warn);
  }
}
.note {
  font-size: var(--text-sm);
  opacity: 0.85;
}
</style>
