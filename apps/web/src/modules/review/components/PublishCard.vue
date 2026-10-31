<script setup lang="ts">
import { Download } from 'lucide-vue-next'
import { formatDateTime } from '@/shared/lib/format'
import { AppButton } from '@/shared/ui'

/**
 * Releasing the results to students, and the grade sheet for the dean's office. `pending`: attempts still
 * written or waiting for review; their results reach the students once decided.
 */
defineProps<{ publishedAt: number | null; publishing: boolean; pending: number }>()
defineEmits<{ publish: []; download: [] }>()
</script>

<template>
  <section class="card">
    <p class="label">
      {{
        publishedAt
          ? $t('hub.results.published', { at: formatDateTime(publishedAt) })
          : $t('hub.results.notPublished')
      }}
    </p>
    <h2>{{ $t('hub.results.publishTitle') }}</h2>
    <p class="text">{{ $t('hub.results.publishText') }}</p>
    <p v-if="pending" class="pending">{{ $t('hub.results.pendingNote', { n: pending }, pending) }}</p>
    <div class="actions">
      <AppButton
        v-if="!publishedAt"
        variant="lime"
        icon="arrow"
        :loading="publishing"
        @click="$emit('publish')"
      >
        {{ $t('hub.results.publish') }}
      </AppButton>
      <AppButton variant="ink" class="soft" @click="$emit('download')">
        <Download :size="16" aria-hidden="true" /> {{ $t('hub.results.download') }}
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
.pending {
  padding: var(--space-3);
  border-radius: var(--radius);
  background: rgb(255 255 255 / 0.08);
  font-size: var(--text-sm);
}
.label,
.text {
  color: var(--on-ink-2);
  font-size: var(--text-sm);
}
h2 {
  font-size: var(--text-xl);
}
.actions {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  margin-top: var(--space-2);
}
.soft {
  background: rgb(255 255 255 / 0.1);
}
</style>
