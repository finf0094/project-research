<script setup lang="ts">
import { AppButton, AppDialog } from '@/shared/ui'

defineProps<{ open: boolean; unanswered: number }>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()
</script>

<template>
  <AppDialog :open="open" :title="$t('exam.finish.title')" @close="emit('cancel')">
    <p>
      {{ unanswered > 0 ? $t('exam.finish.unanswered', { n: unanswered }) : $t('exam.finish.allAnswered') }}
    </p>
    <p class="muted note">{{ $t('exam.finish.offline') }}</p>
    <template #actions>
      <AppButton variant="secondary" @click="emit('cancel')">{{ $t('exam.finish.back') }}</AppButton>
      <AppButton @click="emit('confirm')">{{ $t('exam.finish.submit') }}</AppButton>
    </template>
  </AppDialog>
</template>

<style scoped>
.note {
  margin-top: var(--space-3);
  font-size: var(--text-sm);
}
</style>
