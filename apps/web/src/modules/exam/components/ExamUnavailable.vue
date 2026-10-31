<script setup lang="ts">
import { AppButton, AppCard } from '@/shared/ui'

/** Why the exam page cannot show the exam: it did not load, or another tab holds it. */
defineProps<{ reason: 'load' | 'elsewhere'; oral?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <main class="center">
    <AppCard v-if="reason === 'load'">
      <h1>{{ $t('exam.unavailable.loadFailed') }}</h1>
      <p class="muted">
        {{ $t(oral ? 'exam.unavailable.oralNeedsInternet' : 'exam.unavailable.needsInternet') }}
      </p>
      <AppButton @click="$emit('retry')">{{ $t('common.retry') }}</AppButton>
    </AppCard>
    <AppCard v-else>
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
</style>
