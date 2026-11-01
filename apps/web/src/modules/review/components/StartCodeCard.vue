<script setup lang="ts">
import { Eye, KeyRound } from 'lucide-vue-next'
import { ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, IconTile } from '@/shared/ui'
import { getStartCode } from '../api'

/**
 * The start code of a written exam: students who download the exam ahead of time start it with this code
 * when the room has no network. Hidden until asked for, as it unlocks the questions.
 */
/** `open`: the exam has opened, so the code may be shown (before that it would unlock the questions early). */
const props = defineProps<{ examId: string; open: boolean }>()
const code = ref<string | null>(null)
const load = useAction()
const reveal = () => load.run(async () => (code.value = (await getStartCode(props.examId)).code))
</script>

<template>
  <section class="card">
    <header>
      <IconTile :icon="KeyRound" tone="lime" />
      <h2>{{ $t('hub.startCode.title') }}</h2>
    </header>
    <p class="text">{{ $t('hub.startCode.text') }}</p>
    <Transition name="reveal" mode="out-in">
      <p v-if="code" key="code" class="code" aria-live="polite">{{ code }}</p>
      <p v-else-if="!open" key="later" class="later">{{ $t('hub.startCode.later') }}</p>
      <AppButton v-else key="button" variant="secondary" :loading="load.busy.value" @click="reveal">
        <Eye :size="16" aria-hidden="true" /> {{ $t('hub.startCode.show') }}
      </AppButton>
    </Transition>
    <p v-if="load.error.value" class="error" role="alert">{{ $t(load.error.value) }}</p>
    <p class="muted note">{{ $t('hub.startCode.note') }}</p>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
}
header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-lg);
  }
}
.text,
.note {
  font-size: var(--text-sm);
}
.code {
  padding: var(--space-3) var(--space-5);
  border-radius: var(--radius);
  background: var(--ink);
  color: var(--lime);
  font-family: var(--font-display);
  font-size: var(--text-2xl);
  font-weight: 700;
  letter-spacing: 0.1em;
}
.later {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
  font-weight: 600;
}
.error {
  color: var(--danger);
}
.reveal-enter-active,
.reveal-leave-active {
  transition:
    opacity var(--dur) var(--ease),
    filter var(--dur) var(--ease);
}
.reveal-enter-from {
  opacity: 0;
  filter: blur(8px);
}
.reveal-leave-to {
  opacity: 0;
}
</style>
