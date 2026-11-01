<script setup lang="ts">
import type { SignalKind } from '@exam/contracts'
import type { useExceptions } from '../use-exceptions'

/**
 * Section 25.3, individual exceptions: for a student with special needs, signals that are not watched (the
 * device raises no hint, the server sets no marker). Saved as soon as a box is ticked.
 */
defineProps<{ participants: string[]; exceptions: ReturnType<typeof useExceptions> }>()
const SIGNALS: SignalKind[] = [
  'face_missing',
  'looking_away',
  'noise',
  'multiple_faces',
  'tab_hidden',
  'object_detected',
  'off_center',
  'paste',
]
</script>

<template>
  <section class="exceptions">
    <h3>{{ $t('authoring.exceptions.title') }}</h3>
    <p class="muted">{{ $t('authoring.exceptions.hint') }}</p>
    <p v-if="!participants.length" class="muted">{{ $t('authoring.exceptions.none') }}</p>
    <details v-for="email in participants" :key="email" class="student">
      <summary>
        {{ email }}
        <span v-if="exceptions.disabledFor(email).length" class="count">{{
          $t('authoring.exceptions.count', { n: exceptions.disabledFor(email).length })
        }}</span>
      </summary>
      <fieldset :disabled="exceptions.saving.value.has(email)">
        <legend class="visually-hidden">{{ $t('authoring.exceptions.for', { email }) }}</legend>
        <label v-for="signal in SIGNALS" :key="signal">
          <input
            type="checkbox"
            :checked="exceptions.disabledFor(email).includes(signal)"
            @change="exceptions.toggle(email, signal, ($event.target as HTMLInputElement).checked)"
          />
          {{ $t(`review.marker.${signal}`) }}
        </label>
      </fieldset>
      <p v-if="exceptions.failed.value.has(email)" class="error" role="alert">
        {{ $t(exceptions.failed.value.get(email)!) }}
      </p>
    </details>
  </section>
</template>

<style scoped>
.exceptions {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding-top: var(--space-5);
  border-top: 1px solid var(--border);
  h3 {
    font-size: var(--text-md);
  }
}
.student {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
  summary {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    cursor: pointer;
    font-weight: 600;
  }
}
.count {
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--warn-tint);
  color: var(--warn);
  font-size: var(--text-xs);
}
fieldset {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  border: 0;
  label {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    font-size: var(--text-sm);
  }
  input {
    accent-color: var(--accent);
  }
}
.error {
  color: var(--danger);
}
</style>
