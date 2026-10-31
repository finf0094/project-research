<script setup lang="ts">
import { computed } from 'vue'
import { useProctoringStore } from '../proctoring.store'
import { HINTS } from '../signals'

const proctoring = useProctoringStore()
const text = computed(() => (proctoring.hint ? HINTS[proctoring.hint] : null))
</script>

<template>
  <!-- In the page flow on purpose: a hint must never cover the question. -->
  <Transition name="hint">
    <p v-if="text" class="hint" role="status" aria-live="polite">{{ text }}</p>
  </Transition>
</template>

<style scoped>
.hint {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
  font-weight: 600;
}
.hint-enter-active,
.hint-leave-active {
  transition:
    opacity 0.3s var(--ease),
    translate 0.3s var(--ease);
}
.hint-enter-from,
.hint-leave-to {
  opacity: 0;
  translate: 0 -8px;
}
</style>
