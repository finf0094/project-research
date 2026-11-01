<script setup lang="ts">
import { WifiOff } from 'lucide-vue-next'
import { ref } from 'vue'
import { AppButton, IconTile } from '@/shared/ui'

/**
 * No network at the start, but the exam is already on this device: the student types the start code the
 * proctor announces, and the exam begins; everything is sent once the network is back.
 */
defineProps<{ busy: boolean; error: string | null }>()
const emit = defineEmits<{ start: [code: string] }>()
const code = ref('')
</script>

<template>
  <form class="card" @submit.prevent="emit('start', code)">
    <header>
      <IconTile :icon="WifiOff" tone="peach" />
      <h2>{{ $t('exam.offlineStart.title') }}</h2>
    </header>
    <p class="text">{{ $t('exam.offlineStart.text') }}</p>
    <label class="field">
      {{ $t('exam.offlineStart.code') }}
      <input
        v-model="code"
        class="code"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
        maxlength="16"
        placeholder="XXXXX-XXXXX"
        :aria-invalid="!!error || undefined"
        aria-describedby="code-error"
      />
    </label>
    <p v-if="error" id="code-error" class="error" role="alert">{{ $t(error) }}</p>
    <AppButton
      type="submit"
      variant="lime"
      icon="arrow"
      block
      :loading="busy"
      :disabled="code.trim().length < 10"
    >
      {{ $t('exam.offlineStart.start') }}
    </AppButton>
  </form>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
  animation: rise var(--dur-slow) var(--ease) both;
}
header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-lg);
  }
}
.text {
  color: var(--on-ink-2);
  font-size: var(--text-sm);
}
.field {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.code {
  padding: var(--space-3) var(--space-4);
  border: 2px solid transparent;
  border-radius: var(--radius);
  background: rgb(255 255 255 / 0.1);
  color: var(--on-ink);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  &:focus {
    border-color: var(--lime);
    outline: none;
  }
}
.error {
  color: var(--peach);
  font-weight: 600;
}
</style>
