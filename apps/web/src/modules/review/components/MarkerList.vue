<script setup lang="ts">
import type { Marker, UpdateMarkerBody } from '@exam/contracts'
import { formatTime } from '@/shared/lib/format'
import { IconTile } from '@/shared/ui'
import { MARKER_ICON, MARKER_TONE } from '../marker-look'

/**
 * The markers of an attempt, each with what it is, when, where it came from and the examiner's judgement.
 * The row opens its fragment on the stage; context markers (offline) explain, they are never judged.
 */
defineProps<{ markers: Marker[]; selected: string | null; editable: boolean; busy: boolean }>()
const emit = defineEmits<{ select: [id: string]; judge: [id: string, status: UpdateMarkerBody['status']] }>()
/** Pressing a judgement again takes it back. */
const judge = (m: Marker, status: 'confirmed' | 'dismissed') =>
  emit('judge', m.id, m.status === status ? 'pending' : status)
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
  <TransitionGroup tag="ul" name="list" class="list">
    <li
      v-for="m in markers"
      :key="m.id"
      class="item"
      :class="{ selected: m.id === selected, important: m.discrepancy }"
    >
      <IconTile :icon="MARKER_ICON[m.kind]" :tone="MARKER_TONE[m.status]" />
      <button type="button" class="open" :aria-pressed="m.id === selected" @click="emit('select', m.id)">
        <span class="title">
          {{ $t(`review.marker.${m.kind}`) }}
          <span v-if="m.discrepancy" class="flag">{{ $t('review.markers.important') }}</span>
        </span>
        <span class="meta">
          {{ formatTime(m.startAt) }}–{{ formatTime(m.endAt) }} · {{ $t(`review.markers.${origin(m)}`) }} ·
          {{
            m.chunks.length
              ? $t('review.markers.fragments', { n: m.chunks.length })
              : $t('review.markers.noRecording')
          }}
        </span>
      </button>
      <span v-if="m.status === 'confirmed' || m.status === 'dismissed'" class="verdict" :class="m.status">
        {{ $t(`review.markers.${m.status}`) }}
      </span>
      <div v-if="editable && m.status !== 'context'" class="judge">
        <button
          type="button"
          class="confirm"
          :aria-pressed="m.status === 'confirmed'"
          :disabled="busy"
          @click="judge(m, 'confirmed')"
        >
          {{ $t('review.markers.confirm') }}
        </button>
        <button
          type="button"
          class="dismiss"
          :aria-pressed="m.status === 'dismissed'"
          :disabled="busy"
          @click="judge(m, 'dismissed')"
        >
          {{ $t('review.markers.dismiss') }}
        </button>
      </div>
    </li>
  </TransitionGroup>
</template>

<style scoped>
.list {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: 0;
  list-style: none;
}
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
