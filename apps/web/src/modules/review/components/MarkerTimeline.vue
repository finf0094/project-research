<script setup lang="ts">
import type { Marker } from '@exam/contracts'
import { computed } from 'vue'
import { formatTime } from '@/shared/lib/format'
import { MARKER_LABEL } from '../labels'

const props = defineProps<{ markers: Marker[]; start: number; end: number; selected: string | null }>()
const emit = defineEmits<{ select: [id: string] }>()

const span = computed(() => Math.max(1, props.end - props.start))
const x = (t: number) => ((Math.min(Math.max(t, props.start), props.end) - props.start) / span.value) * 100
const ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, t: props.start + f * span.value })))
</script>

<template>
  <figure class="timeline">
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" role="group" aria-label="Метки на шкале экзамена">
      <rect x="0" y="9" width="100" height="6" rx="3" class="track" />
      <rect
        v-for="m in markers"
        :key="m.id"
        :x="x(m.startAt)"
        y="2"
        :width="Math.max(0.6, x(m.endAt) - x(m.startAt))"
        height="20"
        rx="1"
        class="mark"
        :class="[m.status, { selected: m.id === selected }]"
        tabindex="0"
        role="button"
        :aria-label="`${MARKER_LABEL[m.kind]}, ${formatTime(m.startAt)}`"
        @click="emit('select', m.id)"
        @keydown.enter.prevent="emit('select', m.id)"
        @keydown.space.prevent="emit('select', m.id)"
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
.track {
  fill: var(--surface-2);
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
  &.selected,
  &:focus-visible {
    stroke: var(--accent);
    stroke-width: 0.8;
  }
}
.ticks {
  position: relative;
  block-size: 1.2em;
  font-size: var(--text-xs);
  color: var(--text-2);

  span {
    position: absolute;
    translate: -50% 0;
    &:first-child {
      translate: 0 0;
    }
    &:last-child {
      translate: -100% 0;
    }
  }
}
</style>
