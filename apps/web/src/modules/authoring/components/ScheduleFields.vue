<script setup lang="ts">
import type { ExamDefinition } from '@exam/contracts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { daysBetween, timeOf } from '@/shared/lib/calendar'
import { DateTimePicker } from '@/shared/ui'

/**
 * When an exam runs: the window it can be started in and each student's time. Moving the opening moves
 * the close with it (the window keeps its length); presets set the usual windows in one click.
 */
const model = defineModel<ExamDefinition>({ required: true })
const { t, locale } = useI18n()
const MINUTE = 60_000
const DURATIONS = [30, 45, 60, 90, 120]
/** As the server's sitting rule: a window this much longer than the exam still counts as one sitting. */
const SITTING_SLACK_MIN = 15

const opensAt = computed({
  get: () => model.value.opensAt,
  set: (at: number) =>
    (model.value = {
      ...model.value,
      opensAt: at,
      closesAt: model.value.closesAt + (at - model.value.opensAt),
    }),
})
const closesAt = computed({
  get: () => model.value.closesAt,
  set: (at: number) => (model.value = { ...model.value, closesAt: at }),
})
/** 1–600 whole minutes (the contract's range); the field then shows what was kept. */
function setDuration(minutes: number, input?: HTMLInputElement) {
  const kept = Math.min(600, Math.max(1, Math.round(minutes || 0)))
  model.value = { ...model.value, durationMin: kept }
  if (input) input.value = String(kept)
}

const PRESETS = {
  sitting: () => (model.value.durationMin + SITTING_SLACK_MIN) * MINUTE,
  day: () => 24 * 60 * MINUTE,
  week: () => 7 * 24 * 60 * MINUTE,
}
type Preset = keyof typeof PRESETS
const applyPreset = (preset: Preset) =>
  (model.value = { ...model.value, closesAt: model.value.opensAt + PRESETS[preset]() })
const activePreset = computed(() => {
  const window = model.value.closesAt - model.value.opensAt
  // As the server decides: a window up to the exam plus the slack is a sitting.
  if (window > model.value.durationMin * MINUTE && window <= PRESETS.sitting()) return 'sitting'
  return (['day', 'week'] as const).find((preset) => window === PRESETS[preset]())
})

const invalid = computed(() => model.value.closesAt <= model.value.opensAt)
/** The last start that still gets the whole time (later starts end at the close). */
const fullTimeUntil = computed(() => model.value.closesAt - model.value.durationMin * MINUTE)
const summary = computed(() => {
  const { opensAt: from, closesAt: to } = model.value
  const day = new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long' })
  const until = `${daysBetween(from, fullTimeUntil.value) ? `${day.format(fullTimeUntil.value)}, ` : ''}${timeOf(fullTimeUntil.value)}`
  if (fullTimeUntil.value < from) return t('authoring.schedule.tooShort')
  return t('authoring.schedule.summary', { days: Math.max(1, daysBetween(from, to)), until })
})
</script>

<template>
  <section class="schedule">
    <div class="dates">
      <DateTimePicker v-model="opensAt" :label="t('authoring.settings.opensAt')" />
      <DateTimePicker v-model="closesAt" :label="t('authoring.settings.closesAt')" :min="opensAt" />
    </div>

    <div class="presets" role="group" :aria-label="t('authoring.schedule.window')">
      <span class="caption">{{ t('authoring.schedule.window') }}</span>
      <button
        v-for="preset in ['sitting', 'day', 'week'] as const"
        :key="preset"
        type="button"
        class="chip"
        :aria-pressed="activePreset === preset"
        @click="applyPreset(preset)"
      >
        {{ t(`authoring.schedule.presets.${preset}`) }}
      </button>
    </div>
    <p v-if="activePreset === 'sitting' && model.profile.mode === 'written'" class="note">
      {{ t('authoring.schedule.sittingNote') }}
    </p>

    <div class="duration" role="group" :aria-label="t('authoring.settings.duration')">
      <span class="caption">{{ t('authoring.settings.duration') }}</span>
      <button
        v-for="minutes in DURATIONS"
        :key="minutes"
        type="button"
        class="chip"
        :aria-pressed="model.durationMin === minutes"
        @click="setDuration(minutes)"
      >
        {{ t('authoring.schedule.minutes', { n: minutes }) }}
      </button>
      <input
        class="custom"
        type="number"
        min="1"
        max="600"
        :value="model.durationMin"
        :aria-label="t('authoring.schedule.customDuration')"
        @change="
          setDuration(Number(($event.target as HTMLInputElement).value), $event.target as HTMLInputElement)
        "
      />
    </div>

    <p class="summary" :class="{ error: invalid }" :role="invalid ? 'alert' : undefined">
      {{ invalid ? t('authoring.schedule.closesBeforeOpens') : summary }}
    </p>
  </section>
</template>

<style scoped src="./schedule-fields.css"></style>
