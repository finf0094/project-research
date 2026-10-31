<script setup lang="ts">
import type { Marker } from '@exam/contracts'
import { formatTime } from '@/shared/lib/format'
import { MARKER_ICON } from '../marker-look'
import FragmentPlayer from './FragmentPlayer.vue'
import MarkerTimeline from './MarkerTimeline.vue'

/**
 * The dark stage of a review: the recording around the selected marker, what it is and when, and the
 * whole exam's timeline with every marker to jump to.
 */
defineProps<{
  marker: Marker | null
  sources: string[]
  markers: Marker[]
  start: number
  end: number
}>()
defineEmits<{ select: [id: string] }>()
</script>

<template>
  <section class="stage">
    <Transition name="caption" mode="out-in">
      <p v-if="marker" :key="marker.id" class="caption">
        <component :is="MARKER_ICON[marker.kind]" :size="16" aria-hidden="true" />
        <b>{{ $t(`review.marker.${marker.kind}`) }}</b>
        <span class="time">{{ formatTime(marker.startAt) }}–{{ formatTime(marker.endAt) }}</span>
      </p>
    </Transition>
    <FragmentPlayer :sources="sources" />
    <MarkerTimeline
      :markers="markers"
      :start="start"
      :end="end"
      :selected="marker?.id ?? null"
      @select="$emit('select', $event)"
    />
  </section>
</template>

<style scoped>
.stage {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
.caption {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  svg {
    color: var(--lime);
  }
}
.time {
  margin-inline-start: auto;
  color: var(--on-ink-2);
  font-variant-numeric: tabular-nums;
}
.caption-enter-active,
.caption-leave-active {
  transition:
    opacity var(--dur-fast) var(--ease),
    translate var(--dur-fast) var(--ease);
}
.caption-enter-from,
.caption-leave-to {
  opacity: 0;
  translate: 0 -4px;
}
</style>
