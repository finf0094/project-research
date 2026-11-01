<script setup lang="ts">
import type { AttemptSummary } from '@exam/contracts'
import { ChevronRight } from 'lucide-vue-next'
import { Avatar, StatusPill } from '@/shared/ui'
import RiskBar from './RiskBar.vue'
import { CONNECTION_TONE, STATUS_TONE } from '../labels'

/**
 * The students of an exam, riskiest first: who they are, how far they got, network, markers and the risk
 * that orders the list. Rows glide when the order changes. `oral`: running attempts are calls to join.
 */
defineProps<{ attempts: AttemptSummary[]; oral?: boolean }>()
defineEmits<{
  act: [attempt: AttemptSummary]
  review: [attempt: AttemptSummary]
  room: [attempt: AttemptSummary]
}>()
const DONE = ['ready_for_review', 'decided']
</script>

<template>
  <div class="wrap">
    <table>
      <thead>
        <tr>
          <th scope="col">{{ $t('review.table.student') }}</th>
          <th scope="col">{{ $t('review.table.status') }}</th>
          <th scope="col">{{ $t('review.table.network') }}</th>
          <th scope="col" class="num">{{ $t('review.table.markers') }}</th>
          <th scope="col">{{ $t('review.table.risk') }}</th>
          <th scope="col">
            <span class="visually-hidden">{{ $t('review.table.actions') }}</span>
          </th>
        </tr>
      </thead>
      <TransitionGroup tag="tbody" name="list">
        <tr v-for="a in attempts" :key="a.id">
          <th scope="row">
            <span class="who">
              <Avatar :name="a.student.name" :size="36" />
              <span>
                <span class="name">{{ a.student.name }}</span>
                <span class="muted sub">{{ $t('review.table.answers') }}: {{ a.answered }}</span>
              </span>
            </span>
          </th>
          <td :data-label="$t('review.table.status')">
            <StatusPill :tone="STATUS_TONE[a.status]">{{ $t(`review.status.${a.status}`) }}</StatusPill>
          </td>
          <td :data-label="$t('review.table.network')">
            <span v-if="a.connection" class="net" :class="CONNECTION_TONE[a.connection]">
              <span class="dot" :class="{ live: a.connection === 'online' }" aria-hidden="true" />
              {{ $t(`review.connection.${a.connection}`) }}
            </span>
            <span v-else class="muted">—</span>
          </td>
          <td class="num" :data-label="$t('review.table.markers')">{{ a.markerCount }}</td>
          <td :data-label="$t('review.table.risk')">
            <RiskBar :risk="a.riskScore" />
          </td>
          <td class="actions">
            <button
              v-if="oral && a.status === 'active'"
              type="button"
              class="link"
              :aria-label="$t('review.table.roomOf', { name: a.student.name })"
              @click="$emit('room', a)"
            >
              {{ $t('review.table.room') }}
            </button>
            <button
              v-if="a.status === 'active'"
              type="button"
              class="link"
              :aria-label="$t('review.table.actOf', { name: a.student.name })"
              @click="$emit('act', a)"
            >
              {{ $t('review.table.act') }}
            </button>
            <button
              v-else-if="DONE.includes(a.status)"
              type="button"
              class="open"
              :aria-label="`${$t('review.table.review')} ${a.student.name}`"
              @click="$emit('review', a)"
            >
              <ChevronRight :size="18" />
            </button>
          </td>
        </tr>
      </TransitionGroup>
    </table>
  </div>
</template>

<style scoped src="./attempts-table.css"></style>
