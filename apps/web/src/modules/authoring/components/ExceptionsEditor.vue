<script setup lang="ts">
import type { SignalException, SignalKind } from '@exam/contracts'
import { ref } from 'vue'
import { useAction } from '@/shared/lib/use-action'
import { setException } from '../api'

/**
 * Section 25.3, individual exceptions: for a student with special needs, signals that are not watched (the
 * device raises no hint, the server sets no marker). Saved as soon as a box is ticked.
 */
const props = defineProps<{ examId: string; participants: string[] }>()
/** Owned by the editor page, so the saved state survives switching tabs. */
const exceptions = defineModel<SignalException[]>('exceptions', { required: true })
const SIGNALS: SignalKind[] = [
  'face_missing',
  'looking_away',
  'noise',
  'multiple_faces',
  'tab_hidden',
  'object_detected',
  'paste',
]

const disabledFor = (email: string) => exceptions.value.find((e) => e.email === email)?.disabledSignals ?? []
const withSignals = (email: string, disabledSignals: SignalKind[]) => [
  ...exceptions.value.filter((e) => e.email !== email),
  { email, disabledSignals },
]
const save = useAction()
const saving = ref(new Set<string>())

/** Shown at once and saved; a refused save puts the student's previous list back. */
async function toggle(email: string, signal: SignalKind, on: boolean) {
  const before = disabledFor(email)
  const next = on ? [...before, signal] : before.filter((s) => s !== signal)
  exceptions.value = withSignals(email, next)
  saving.value = new Set(saving.value).add(email)
  const saved = await save.run(() => setException(props.examId, { email, disabledSignals: next }))
  if (!saved) exceptions.value = withSignals(email, before)
  const rest = new Set(saving.value)
  rest.delete(email)
  saving.value = rest
}
</script>

<template>
  <section class="exceptions">
    <h3>{{ $t('authoring.exceptions.title') }}</h3>
    <p class="muted">{{ $t('authoring.exceptions.hint') }}</p>
    <p v-if="!participants.length" class="muted">{{ $t('authoring.exceptions.none') }}</p>
    <details v-for="email in participants" :key="email" class="student">
      <summary>
        {{ email }}
        <span v-if="disabledFor(email).length" class="count">{{
          $t('authoring.exceptions.count', { n: disabledFor(email).length })
        }}</span>
      </summary>
      <fieldset :disabled="saving.has(email)">
        <legend class="visually-hidden">{{ $t('authoring.exceptions.for', { email }) }}</legend>
        <label v-for="signal in SIGNALS" :key="signal">
          <input
            type="checkbox"
            :checked="disabledFor(email).includes(signal)"
            @change="toggle(email, signal, ($event.target as HTMLInputElement).checked)"
          />
          {{ $t(`review.marker.${signal}`) }}
        </label>
      </fieldset>
    </details>
    <p v-if="save.error.value" class="error" role="alert">{{ $t(save.error.value) }}</p>
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
