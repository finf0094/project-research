<script setup lang="ts">
import type { Marker, MarkerKind, UpdateMarkerBody } from '@exam/contracts'
import { ChevronRight } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { IconTile } from '@/shared/ui'
import { groupMarkers, type MarkerGroup } from '../marker-groups'
import { MARKER_ICON, MARKER_TONE } from '../marker-look'
import MarkerRow from './MarkerRow.vue'

/**
 * The markers of an attempt, one row per kind: a kind seen once is its marker; a kind seen many times is
 * a row with a count that opens to its markers and to judging all still pending at once.
 */
const props = defineProps<{ markers: Marker[]; selected: string | null; editable: boolean; busy: boolean }>()
const emit = defineEmits<{
  select: [id: string]
  judge: [id: string, status: UpdateMarkerBody['status']]
  judgeAll: [ids: string[], status: 'confirmed' | 'dismissed']
}>()
const groups = computed(() => groupMarkers(props.markers))

const open = ref(new Set<MarkerKind>())
const toggle = (kind: MarkerKind) => (open.value.has(kind) ? open.value.delete(kind) : open.value.add(kind))
// A marker picked on the stage's timeline shows in the list: its group opens (not on the first load).
watch(
  () => props.selected,
  (id, before) => {
    const kind = props.markers.find((m) => m.id === id)?.kind
    if (before && kind) open.value.add(kind)
  },
)
const tone = (g: MarkerGroup) => (g.pending.length ? 'peach' : MARKER_TONE[g.markers[0]!.status])
const judgeAll = (g: MarkerGroup, status: 'confirmed' | 'dismissed') =>
  !props.busy && emit('judgeAll', g.pending, status)
</script>

<template>
  <header class="head">
    <h2>{{ $t('review.attempt.markers') }}</h2>
    <p class="muted note">
      {{ $t(markers.length ? 'review.attempt.markersHint' : 'review.attempt.noMarkers') }}
    </p>
  </header>
  <TransitionGroup tag="ul" name="list" class="list">
    <template v-for="g in groups" :key="g.kind">
      <MarkerRow
        v-if="g.markers.length === 1"
        :marker="g.markers[0]!"
        :selected="g.markers[0]!.id === selected"
        :editable="editable"
        :busy="busy"
        @select="emit('select', $event)"
        @judge="(id, status) => emit('judge', id, status)"
      />
      <li v-else class="group" :class="{ open: open.has(g.kind) }">
        <button
          type="button"
          class="group-toggle"
          :aria-expanded="open.has(g.kind)"
          :aria-controls="`markers-${g.kind}`"
          @click="toggle(g.kind)"
        >
          <IconTile :icon="MARKER_ICON[g.kind]" :tone="tone(g)" />
          <span class="text">
            <span class="title">
              {{ $t(`review.marker.${g.kind}`) }}
              <span class="count">×{{ g.markers.length }}</span>
              <span v-if="g.important" class="flag">{{ $t('review.markers.important') }}</span>
            </span>
            <span class="meta">{{
              g.pending.length
                ? $t('review.markers.left', { n: g.pending.length })
                : $t('review.markers.allJudged')
            }}</span>
          </span>
          <ChevronRight class="chevron" :size="20" aria-hidden="true" />
        </button>
        <div v-if="open.has(g.kind)" :id="`markers-${g.kind}`" class="body">
          <div v-if="editable && g.pending.length" class="bulk">
            <button type="button" class="dismiss" :aria-disabled="busy" @click="judgeAll(g, 'dismissed')">
              {{ $t('review.markers.dismissAll', { n: g.pending.length }) }}
            </button>
            <button type="button" class="confirm" :aria-disabled="busy" @click="judgeAll(g, 'confirmed')">
              {{ $t('review.markers.confirmAll', { n: g.pending.length }) }}
            </button>
          </div>
          <ul class="list">
            <MarkerRow
              v-for="m in g.markers"
              :key="m.id"
              :marker="m"
              :selected="m.id === selected"
              :editable="editable"
              :busy="busy"
              @select="emit('select', $event)"
              @judge="(id, status) => emit('judge', id, status)"
            />
          </ul>
        </div>
      </li>
    </template>
  </TransitionGroup>
</template>

<style scoped src="./marker-list.css"></style>
