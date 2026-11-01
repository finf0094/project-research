<script setup lang="ts">
import type { Marker } from '@exam/contracts'
import { computed } from 'vue'
import { formatTime } from '@/shared/lib/format'

const props = defineProps<{ markers: Marker[]; start: number; end: number; selected: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const span = computed(() => Math.max(1, props.end - props.start))
const x = (t: number) => ((Math.min(Math.max(t, props.start), props.end) - props.start) / span.value) * 100
/** One tab stop for the whole timeline (the selected mark, else the first); arrows move between marks. */
const focusable = computed(() => props.selected ?? props.markers[0]?.id ?? null)
function step(event: KeyboardEvent, index: number, by: -1 | 1) {
  const next = props.markers[index + by]
  if (!next) return
  emit('select', next.id)
  const marks = (event.currentTarget as SVGElement).parentElement?.querySelectorAll<SVGElement>('.mark')
  marks?.[index + by]?.focus()
}
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, t: props.start + f * span.value })))
</script>

<template>
  <figure class="timeline">
    <svg
      viewBox="0 0 100 24"
      preserveAspectRatio="none"
      role="group"
      :aria-label="$t('review.attempt.timeline')"
    >
      <rect x="0" y="9" width="100" height="6" rx="3" class="track" />
      <rect
        v-for="(m, i) in markers"
        :key="m.id"
        :x="x(m.startAt)"
        y="2"
        :width="Math.max(0.6, x(m.endAt) - x(m.startAt))"
        height="20"
        rx="1"
        class="mark"
        :class="[m.status, { selected: m.id === selected }]"
        :tabindex="m.id === focusable ? 0 : -1"
        role="button"
        :aria-pressed="m.id === selected"
        :aria-label="`${$t(`review.marker.${m.kind}`)}, ${formatTime(m.startAt)}`"
        @click="emit('select', m.id)"
        @keydown.enter.prevent="emit('select', m.id)"
        @keydown.space.prevent="emit('select', m.id)"
        @keydown.right.prevent="step($event, i, 1)"
        @keydown.left.prevent="step($event, i, -1)"
      />
    </svg>
    <figcaption class="ticks">
      <span v-for="tick in ticks" :key="tick.f" :style="{ insetInlineStart: `${tick.f * 100}%` }">{{
        formatTime(tick.t)
      }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.timeline {
  display: grid;
  gap: var(--space-2);
}
svg {
  inline-size: 100%;
  block-size: 48px;
}
/* Drawn from the surrounding text colour: it reads on a light card and on the dark stage alike. */
.track {
  fill: color-mix(in oklab, currentColor 14%, transparent);
}
.mark {
  fill: var(--warn);
  cursor: pointer;
  outline: none;

  &.context {
    fill: var(--off);
    opacity: 0.45;
  }
  &.confirmed {
    fill: var(--danger);
  }
  &.dismissed {
    fill: var(--ok);
  }
  /* The viewBox is stretched: a non-scaling stroke keeps the ring 2px whatever the width. */
  &.selected,
  &:focus-visible {
    stroke: var(--lime);
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }
}
.ticks {
  position: relative;
  block-size: 1.2em;
  font-size: var(--text-xs);
  opacity: 0.7;

  span {
    position: absolute;
    translate: -50% 0;
    /* "12:32:14 PM": an absolute box at the edge would otherwise wrap the English "PM" onto a new line. */
    white-space: nowrap;
    &:first-child {
      translate: 0 0;
    }
    &:last-child {
      translate: -100% 0;
    }
  }
}
/* On a narrow screen five times collide: keep the start, the middle and the end. */
@media (width < 600px) {
  .ticks span:nth-child(2),
  .ticks span:nth-child(4) {
    display: none;
  }
}
</style>
