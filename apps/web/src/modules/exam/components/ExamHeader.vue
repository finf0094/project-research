<script setup lang="ts">
import { SyncStatusBadge } from '@/modules/offline'
import { AppButton, AppLogo } from '@/shared/ui'
import ExamTimer from './ExamTimer.vue'

defineProps<{ title: string; step: string; remainingMs: number; finishing: boolean }>()
defineEmits<{ finish: [] }>()
</script>

<template>
  <header class="header">
    <div class="title">
      <AppLogo :wordmark="false" />
      <div>
        <h1 class="name">{{ title }}</h1>
        <p class="muted step">{{ step }}</p>
      </div>
    </div>
    <SyncStatusBadge />
    <div class="actions">
      <ExamTimer :remaining-ms="remainingMs" />
      <AppButton :loading="finishing" @click="$emit('finish')">{{ $t('exam.header.submit') }}</AppButton>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-5);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
.title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.name {
  /* The page's heading, styled as plain header text. */
  font-family: var(--font-sans);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: normal;
  line-height: 1.4;
}
.step {
  font-size: var(--text-sm);
}
.actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
