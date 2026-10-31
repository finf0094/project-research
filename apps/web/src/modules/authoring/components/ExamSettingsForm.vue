<script setup lang="ts">
import type { ExamDefinition, ExamMode, RecordingMode } from '@exam/contracts'
import { computed } from 'vue'
import { fromLocalInput, toLocalInput, useFields } from '@/shared/lib/fields'

/** Title, timing and format of an exam (everything except the questions). */
const model = defineModel<ExamDefinition>({ required: true })
defineProps<{ disabled: boolean }>()
const field = useFields(model)
const title = field('title')
const durationMin = field('durationMin')
const profile = field('profile')

const date = (key: 'opensAt' | 'closesAt') =>
  computed({
    get: () => toLocalInput(model.value[key]),
    set: (value: string) => value && (model.value = { ...model.value, [key]: fromLocalInput(value) }),
  })
const opensAt = date('opensAt')
const closesAt = date('closesAt')

function setMode(mode: ExamMode) {
  // An oral exam is recorded in full and draws a ticket; a written one shows every question.
  profile.value =
    mode === 'oral'
      ? { mode, recording: 'full', ticketSize: Math.min(2, model.value.questions.length) || 1 }
      : { mode, recording: 'adaptive' }
}
const setRecording = (recording: RecordingMode) => (profile.value = { ...profile.value, recording })
const setTicketSize = (n: number) => (profile.value = { ...profile.value, ticketSize: n })
</script>

<template>
  <fieldset class="settings" :disabled="disabled">
    <legend>{{ $t('authoring.settings.title') }}</legend>
    <label class="wide">
      {{ $t('authoring.settings.name') }}
      <input v-model.trim="title" required maxlength="200" />
    </label>
    <label>
      {{ $t('authoring.settings.opensAt') }}
      <input v-model="opensAt" type="datetime-local" required />
    </label>
    <label>
      {{ $t('authoring.settings.closesAt') }}
      <input v-model="closesAt" type="datetime-local" required />
    </label>
    <label>
      {{ $t('authoring.settings.duration') }}
      <input v-model.number="durationMin" type="number" min="1" max="600" required />
    </label>
    <label>
      {{ $t('authoring.settings.mode') }}
      <select :value="profile.mode" @change="setMode(($event.target as HTMLSelectElement).value as ExamMode)">
        <option value="written">{{ $t('authoring.settings.written') }}</option>
        <option value="oral">{{ $t('authoring.settings.oral') }}</option>
      </select>
    </label>
    <label>
      {{ $t('authoring.settings.recording') }}
      <select
        :value="profile.recording"
        @change="setRecording(($event.target as HTMLSelectElement).value as RecordingMode)"
      >
        <option value="adaptive">{{ $t('authoring.settings.adaptive') }}</option>
        <option value="full">{{ $t('authoring.settings.full') }}</option>
      </select>
    </label>
    <label v-if="profile.mode === 'oral'">
      {{ $t('authoring.settings.ticketSize') }}
      <input
        :value="profile.ticketSize"
        type="number"
        min="1"
        :max="model.questions.length"
        required
        @input="setTicketSize(Number(($event.target as HTMLInputElement).value))"
      />
    </label>
  </fieldset>
</template>

<style scoped>
.settings {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: var(--space-3);
  font-family: var(--font-display);
  font-size: var(--text-lg);
}
label {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.wide {
  grid-column: 1 / -1;
}
</style>
