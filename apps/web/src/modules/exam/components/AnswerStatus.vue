<script setup lang="ts">
import { Check, CircleAlert } from 'lucide-vue-next'
import { formatClock } from '@/shared/lib/format'

/**
 * Under the answer: that it is stored on this device (and when), or that storing failed; and the way to
 * take it back. Nothing shows before the first answer.
 */
defineProps<{ answered: boolean; savedAt: number | undefined; failed: boolean; locked: boolean }>()
defineEmits<{ clear: [] }>()
</script>

<template>
  <footer class="status">
    <Transition name="fade" mode="out-in">
      <p v-if="failed" key="failed" class="failed" role="alert">
        <CircleAlert :size="16" aria-hidden="true" /> {{ $t('exam.answer.failed') }}
      </p>
      <p v-else-if="answered" :key="savedAt ?? 'saved'" class="saved">
        <Check :size="16" aria-hidden="true" />
        {{ savedAt ? $t('exam.answer.savedAt', { at: formatClock(savedAt) }) : $t('exam.answer.saved') }}
      </p>
    </Transition>
    <button v-if="answered && !locked" type="button" class="clear" @click="$emit('clear')">
      {{ $t('exam.answer.clear') }}
    </button>
  </footer>
</template>

<style scoped>
.status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-block-size: 28px;
  font-size: var(--text-sm);
}
.saved,
.failed {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}
.saved {
  color: var(--ok);
}
.failed {
  color: var(--danger);
}
.clear {
  margin-inline-start: auto;
  padding: var(--space-1) var(--space-2);
  border: 0;
  border-radius: var(--radius-sm);
  background: none;
  color: var(--text-2);
  font-weight: 600;
  &:hover {
    color: var(--text);
  }
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--dur-fast) var(--ease);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
