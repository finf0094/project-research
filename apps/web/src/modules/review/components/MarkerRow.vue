<script setup lang="ts">
import type { Marker, UpdateMarkerBody } from '@exam/contracts'
import { formatTime } from '@/shared/lib/format'
import { IconTile } from '@/shared/ui'
import { MARKER_ICON, MARKER_TONE } from '../marker-look'

/**
 * One marker: what it is, when, where it came from and the examiner's judgement. The row opens its
 * fragment on the stage; context markers (offline) explain, they are never judged.
 */
const props = defineProps<{ marker: Marker; selected: boolean; editable: boolean; busy: boolean }>()
const emit = defineEmits<{ select: [id: string]; judge: [id: string, status: UpdateMarkerBody['status']] }>()
/** Pressing a judgement again takes it back. While one is saving, presses are ignored (focus stays put). */
const judge = (status: 'confirmed' | 'dismissed') =>
  !props.busy && emit('judge', props.marker.id, props.marker.status === status ? 'pending' : status)
const origin = (m: Marker) =>
  m.discrepancy
    ? 'discrepancy'
    : m.status === 'context'
      ? 'context'
      : m.source === 'model'
        ? 'byModel'
        : 'byDevice'
</script>

<template>
  <li class="item" :class="{ selected, important: marker.discrepancy }">
    <IconTile :icon="MARKER_ICON[marker.kind]" :tone="MARKER_TONE[marker.status]" />
    <button type="button" class="open" :aria-pressed="selected" @click="emit('select', marker.id)">
      <span class="title">
        {{ $t(`review.marker.${marker.kind}`) }}
        <span v-if="marker.discrepancy" class="flag">{{ $t('review.markers.important') }}</span>
      </span>
      <span class="meta">
        {{ formatTime(marker.startAt) }}–{{ formatTime(marker.endAt) }} ·
        {{ $t(`review.markers.${origin(marker)}`) }} ·
        {{
          marker.chunks.length
            ? $t('review.markers.fragments', { n: marker.chunks.length })
            : $t('review.markers.noRecording')
        }}
      </span>
    </button>
    <span
      v-if="marker.status === 'confirmed' || marker.status === 'dismissed'"
      class="verdict"
      :class="marker.status"
    >
      {{ $t(`review.markers.${marker.status}`) }}
    </span>
    <div v-if="editable && marker.status !== 'context'" class="judge">
      <button
        type="button"
        class="confirm"
        :aria-pressed="marker.status === 'confirmed'"
        :aria-disabled="busy"
        @click="judge('confirmed')"
      >
        {{ $t('review.markers.confirm') }}
      </button>
      <button
        type="button"
        class="dismiss"
        :aria-pressed="marker.status === 'dismissed'"
        :aria-disabled="busy"
        @click="judge('dismissed')"
      >
        {{ $t('review.markers.dismiss') }}
      </button>
    </div>
  </li>
</template>

<style scoped>
.item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius);
  transition: background-color var(--dur) var(--ease);
  &:hover {
    background: var(--surface-2);
  }
  &.selected {
    background: var(--accent-tint);
    box-shadow: inset 3px 0 0 var(--accent);
  }
}
.open {
  display: grid;
  flex: 1;
  gap: 2px;
  min-inline-size: 200px;
  padding: 0;
  border: 0;
  background: none;
  text-align: start;
}
.title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}
.flag {
  padding: 1px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--danger);
  color: var(--on-danger);
  font-size: var(--text-xs);
}
.meta {
  color: var(--text-2);
  font-size: var(--text-xs);
}
.verdict {
  font-size: var(--text-xs);
  font-weight: 700;
  &.confirmed {
    color: var(--danger);
  }
  &.dismissed {
    color: var(--ok);
  }
}
.judge {
  display: flex;
  gap: var(--space-2);
  button {
    min-block-size: 36px;
    @media (pointer: coarse) {
      min-block-size: var(--tap);
    }
    padding: 0 var(--space-4);
    border: 0;
    border-radius: var(--radius-pill);
    font-size: var(--text-sm);
    font-weight: 600;
    transition:
      background-color var(--dur) var(--ease),
      color var(--dur) var(--ease),
      scale var(--dur-fast) var(--ease);
    &:active {
      scale: 0.96;
    }
    &[aria-disabled='true'] {
      opacity: 0.6;
      cursor: progress;
    }
  }
}
.confirm {
  background: var(--ink);
  color: var(--on-ink);
  &[aria-pressed='true'] {
    background: var(--danger);
    color: var(--on-danger);
  }
}
.dismiss {
  background: var(--surface-2);
  color: var(--text);
  &[aria-pressed='true'] {
    background: var(--ok);
    color: var(--on-ok);
  }
}
</style>
