<script setup lang="ts">
import { HintBanner } from '@/modules/proctoring'
import { useExamStore } from '../exam.store'
import ExamHeader from './ExamHeader.vue'
import ExaminerMessage from './ExaminerMessage.vue'
import ExamNotices from './ExamNotices.vue'
import ExamUnavailable from './ExamUnavailable.vue'
import FinishDialog from './FinishDialog.vue'

/** The frame of a running exam page: header, notices, hints, finishing and examiner messages around the content. */
defineProps<{ attemptId: string; step: string; loadError: boolean; unanswered: number; oral?: boolean }>()
const confirming = defineModel<boolean>('confirming', { required: true })
defineEmits<{ retry: []; finish: [] }>()
const exam = useExamStore()
</script>

<template>
  <ExamUnavailable v-if="loadError" reason="load" :oral="oral" @retry="$emit('retry')" />
  <ExamUnavailable v-else-if="exam.openedElsewhere" reason="elsewhere" />

  <div v-else-if="exam.attempt" class="exam">
    <ExamHeader
      :title="exam.attempt.exam.title"
      :step="step"
      :remaining-ms="exam.remainingMs"
      :finishing="exam.locked"
      @finish="confirming = true"
    />
    <ExamNotices
      :attempt-id="attemptId"
      :signed-out="exam.signedOut"
      :save-failed="exam.saveFailed"
      :chain-broken="exam.chainBroken"
    />
    <HintBanner />
    <slot />
    <FinishDialog
      :open="confirming"
      :unanswered="unanswered"
      @confirm="$emit('finish')"
      @cancel="confirming = false"
    />
    <ExaminerMessage :message="exam.warning" @close="exam.warning = null" />
  </div>
</template>

<style scoped>
.exam {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  min-height: 100dvh;
  padding: var(--space-4);
  align-content: start;
}
</style>
