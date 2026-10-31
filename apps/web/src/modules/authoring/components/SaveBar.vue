<script setup lang="ts">
import { AppButton } from '@/shared/ui'

/** Stays at the bottom of the screen with the latest word on saving: saving is always one click away. */
defineProps<{
  message: { tone: 'ok' | 'error' | 'muted'; text: string } | null
  saving: boolean
  label: string
}>()
</script>

<template>
  <footer class="bar">
    <div class="message" role="status">
      <Transition name="fade" mode="out-in">
        <p v-if="message" :key="message.text" :class="message.tone">{{ message.text }}</p>
      </Transition>
    </div>
    <AppButton type="submit" icon="arrow" :loading="saving">{{ label }}</AppButton>
  </footer>
</template>

<style scoped>
.bar {
  position: sticky;
  bottom: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-2);
}
@media (width < 600px) {
  .bar :deep(.button) {
    flex: 1;
  }
}
.message {
  flex: 1 1 260px;
  min-inline-size: 0;
  font-size: var(--text-sm);
}
.ok {
  color: var(--ok);
  font-weight: 600;
}
.error {
  color: var(--danger);
}
.muted {
  color: var(--text-2);
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
