<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProctoringStore } from '../proctoring.store'

const proctoring = useProctoringStore()
const { t } = useI18n()
const text = computed(() => (proctoring.hint ? t(`proctoring.hint.${proctoring.hint}`) : null))
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
