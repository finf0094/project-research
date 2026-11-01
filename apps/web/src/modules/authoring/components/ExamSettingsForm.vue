<script setup lang="ts">
import type { ExamDefinition, ExamMode, RecordingMode } from '@exam/contracts'
import { Mic, PenLine, ScanEye, Video } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFields } from '@/shared/lib/fields'
import { ChoiceCards } from '@/shared/ui'
import { changeType } from '../draft'
import ScheduleFields from './ScheduleFields.vue'

/** Title, format, timing and recording of an exam (everything except the questions). */
const model = defineModel<ExamDefinition>({ required: true })
defineProps<{ disabled: boolean }>()
const { t } = useI18n()
const field = useFields(model)
const title = field('title')
const profile = field('profile')

const modes = computed(() =>
  (['written', 'oral'] as const).map((value) => ({
    value,
    title: t(`authoring.settings.${value}`),
    text: t(`authoring.settings.${value}Text`),
    icon: value === 'written' ? PenLine : Mic,
  })),
)
const recordings = computed(() =>
  (['adaptive', 'full'] as const).map((value) => ({
    value,
    title: t(`authoring.settings.${value}`),
    text: t(`authoring.settings.${value}Text`),
    icon: value === 'adaptive' ? ScanEye : Video,
  })),
)

const mode = computed({
  get: () => profile.value.mode,
  set: (next: ExamMode) => {
    const { questions } = model.value
    if (next === 'written') {
      model.value = { ...model.value, profile: { mode: next, recording: profile.value.recording } }
      return
    }
    // An oral exam is recorded in full, draws a ticket, and its questions are open (answered aloud).
    model.value = {
      ...model.value,
      profile: { mode: next, recording: 'full', ticketSize: Math.min(2, questions.length) || 1 },
      questions: questions.map((q) => (q.type === 'text' ? q : changeType(q, 'text'))),
    }
  },
})
const recording = computed({
  get: () => profile.value.recording,
  set: (next: RecordingMode) => (profile.value = { ...profile.value, recording: next }),
})
const setTicketSize = (n: number) => n > 0 && (profile.value = { ...profile.value, ticketSize: n })
</script>

<template>
  <fieldset class="settings" :disabled="disabled">
    <legend>{{ t('authoring.settings.title') }}</legend>
    <label class="name">
      {{ t('authoring.settings.name') }}
      <input
        v-model.trim="title"
        required
        maxlength="200"
        :placeholder="t('authoring.settings.namePlaceholder')"
      />
    </label>

    <ChoiceCards v-model="mode" :label="t('authoring.settings.mode')" :items="modes" :disabled="disabled" />

    <ScheduleFields v-model="model" />

    <ChoiceCards
      v-model="recording"
      :label="t('authoring.settings.recording')"
      :items="recordings"
      :disabled="disabled || mode === 'oral'"
    />

    <label v-if="mode === 'oral'" class="ticket">
      {{ t('authoring.settings.ticketSize') }}
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
  gap: var(--space-5);
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
.name input {
  min-height: 52px;
  font-size: var(--text-md);
}
.ticket {
  max-width: 220px;
}
</style>
