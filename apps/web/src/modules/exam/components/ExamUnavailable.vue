<script setup lang="ts">
import { MonitorSmartphone, WifiOff } from 'lucide-vue-next'
import { AppButton, AppCard } from '@/shared/ui'

/** Why the exam page cannot show the exam: it did not load, or another tab holds it. */
defineProps<{ reason: 'load' | 'elsewhere'; oral?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <main class="center">
    <AppCard v-if="reason === 'load'" class="card">
      <span class="icon"><WifiOff :size="28" aria-hidden="true" /></span>
      <h1>{{ $t('exam.unavailable.loadFailed') }}</h1>
      <p class="muted">
        {{ $t(oral ? 'exam.unavailable.oralNeedsInternet' : 'exam.unavailable.needsInternet') }}
      </p>
      <AppButton block @click="$emit('retry')">{{ $t('common.retry') }}</AppButton>
    </AppCard>
    <AppCard v-else class="card">
      <span class="icon"><MonitorSmartphone :size="28" aria-hidden="true" /></span>
      <h1>{{ $t('exam.unavailable.elsewhere') }}</h1>
      <p class="muted">{{ $t('exam.unavailable.elsewhereHint') }}</p>
    </AppCard>
  </main>
</template>

<style scoped>
.center {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-4);
  text-align: center;
}
.card {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  max-inline-size: 440px;
  animation: rise var(--dur-slow) var(--ease) both;
  h1 {
    font-size: var(--text-xl);
  }
  > :last-child {
    margin-block-start: var(--space-3);
  }
}
.icon {
  display: grid;
  place-items: center;
  inline-size: 64px;
  block-size: 64px;
  border-radius: 50%;
  background: var(--accent-tint);
  color: var(--accent-ink);
}
</style>
