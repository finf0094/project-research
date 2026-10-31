<script setup lang="ts">
import { AppButton, AppDialog } from '@/shared/ui'

/** A warning the examiner sent during the exam. */
defineProps<{ message: string | null }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <AppDialog :open="!!message" :title="$t('common.teacherMessage')" @close="$emit('close')">
    <p>{{ message }}</p>
    <template #actions>
      <AppButton @click="$emit('close')">{{ $t('common.understood') }}</AppButton>
    </template>
  </AppDialog>
</template>
