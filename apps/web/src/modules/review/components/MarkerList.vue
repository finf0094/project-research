<script setup lang="ts">
import type { Marker } from '@exam/contracts'
import { formatTime } from '@/shared/lib/format'
import { AppButton, StatusPill } from '@/shared/ui'
import { MARKER_LABEL } from '../labels'

defineProps<{ markers: Marker[]; selected: string | null; editable: boolean }>()
const emit = defineEmits<{ select: [id: string]; judge: [id: string, status: 'confirmed' | 'dismissed'] }>()
</script>

<template>
  <ul class="list">
    <li v-for="m in markers" :key="m.id" class="item" :class="{ selected: m.id === selected }">
      <button type="button" class="open" @click="emit('select', m.id)">
        <span class="title">{{ MARKER_LABEL[m.kind] }}</span>
        <span class="muted time">
          {{ formatTime(m.startAt) }}–{{ formatTime(m.endAt) }} ·
          {{ m.chunks.length ? `фрагментов: ${m.chunks.length}` : 'без записи' }}
        </span>
      </button>
      <StatusPill v-if="m.discrepancy" tone="danger">Сервер увидел, устройство — нет</StatusPill>
      <StatusPill v-else-if="m.source === 'model'" tone="accent">Проверка сервером</StatusPill>
      <StatusPill v-if="m.status === 'context'">Контекст, не нарушение</StatusPill>
      <StatusPill v-else-if="m.status === 'confirmed'" tone="danger">Подтверждено</StatusPill>
      <StatusPill v-else-if="m.status === 'dismissed'" tone="ok">Отклонено</StatusPill>
      <div v-if="editable && m.status !== 'context'" class="judge">
        <AppButton
          variant="ink"
          :disabled="m.status === 'confirmed'"
          @click="emit('judge', m.id, 'confirmed')"
          >Подтвердить</AppButton
        >
        <AppButton
          variant="secondary"
          :disabled="m.status === 'dismissed'"
          @click="emit('judge', m.id, 'dismissed')"
          >Отклонить</AppButton
        >
      </div>
    </li>
  </ul>
</template>

<style scoped>
.list {
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

  &.selected {
    background: var(--surface-2);
  }
}
.open {
  display: grid;
  flex: 1;
  min-inline-size: 220px;
  padding: 0;
  border: 0;
  background: none;
  text-align: start;
}
.title {
  font-weight: 600;
}
.time {
  font-size: var(--text-xs);
}
.judge {
  display: flex;
  gap: var(--space-2);
}
.judge :deep(.button) {
  min-height: 36px;
  padding-inline: var(--space-4);
  font-size: var(--text-sm);
}
</style>
