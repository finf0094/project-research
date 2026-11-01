<script setup lang="ts">
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { computed, ref, useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { atTime, monthGrid, onDay, sameDay, startOfDay, timeOf, weekdayNames } from '@/shared/lib/calendar'
import { placeNextToOpener } from '@/shared/lib/popover'

/**
 * A date and time in the app's own look (the browser's picker differs per system and language): the field
 * reads "Mon, 2 November · 16:00"; a popover holds the month, Monday first, and the time of day.
 */
const props = defineProps<{ label: string; min?: number }>()
const model = defineModel<number>({ required: true })
const { locale, t } = useI18n()
const id = useId()
/** Times an exam usually starts at; any other is typed in. */
const TIMES = ['08:00', '09:00', '10:00', '12:00', '14:00', '16:00', '18:00']

const view = ref({ year: 0, month: 0 })
const showMonthOf = (ms: number) => {
  const d = new Date(ms)
  view.value = { year: d.getFullYear(), month: d.getMonth() }
}
showMonthOf(model.value)
function onToggle(event: Event) {
  placeNextToOpener(event)
  if ((event as ToggleEvent).newState === 'open') showMonthOf(model.value)
}
function shiftMonth(by: number) {
  const d = new Date(view.value.year, view.value.month + by, 1)
  view.value = { year: d.getFullYear(), month: d.getMonth() }
}

const days = computed(() => monthGrid(view.value.year, view.value.month))
const weekdays = computed(() => weekdayNames(locale.value))
const monthTitle = computed(() =>
  new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    new Date(view.value.year, view.value.month, 1),
  ),
)
const dayName = (ms: number) =>
  new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(ms)
const shown = computed(
  () =>
    `${new Intl.DateTimeFormat(locale.value, { weekday: 'short', day: 'numeric', month: 'long' }).format(model.value)} · ${timeOf(model.value)}`,
)
const today = startOfDay(Date.now())
const tooEarly = (day: number) => props.min !== undefined && day < startOfDay(props.min)
const outside = (day: number) => new Date(day).getMonth() !== view.value.month

const pickDay = (day: number) => (model.value = onDay(day, model.value))
const pickTime = (time: string) => time && (model.value = atTime(model.value, time))
const close = (event: Event) =>
  (event.currentTarget as HTMLElement).closest<HTMLElement>('[popover]')?.hidePopover()
</script>

<template>
  <div class="picker">
    <span :id="`${id}-label`" class="label">{{ label }}</span>
    <button type="button" class="field" :popovertarget="id" :aria-labelledby="`${id}-label ${id}-value`">
      <CalendarDays :size="18" aria-hidden="true" />
      <span :id="`${id}-value`">{{ shown }}</span>
    </button>

    <div :id="id" popover class="panel" @toggle="onToggle">
      <header class="month">
        <button type="button" class="nav" :aria-label="t('common.picker.prev')" @click="shiftMonth(-1)">
          <ChevronLeft :size="18" aria-hidden="true" />
        </button>
        <strong aria-live="polite">{{ monthTitle }}</strong>
        <button type="button" class="nav" :aria-label="t('common.picker.next')" @click="shiftMonth(1)">
          <ChevronRight :size="18" aria-hidden="true" />
        </button>
      </header>
      <div class="grid" role="group" :aria-label="monthTitle">
        <span v-for="day in weekdays" :key="day" class="weekday" aria-hidden="true">{{ day }}</span>
        <button
          v-for="day in days"
          :key="day"
          type="button"
          class="day"
          :class="{ outside: outside(day), today: day === today }"
          :aria-pressed="sameDay(day, model)"
          :aria-label="dayName(day)"
          :disabled="tooEarly(day)"
          @click="pickDay(day)"
        >
          {{ new Date(day).getDate() }}
        </button>
      </div>

      <div class="time" role="group" :aria-label="t('common.picker.time')">
        <span class="time-label">{{ t('common.picker.time') }}</span>
        <div class="chips">
          <button
            v-for="time in TIMES"
            :key="time"
            type="button"
            class="chip"
            :aria-pressed="timeOf(model) === time"
            @click="pickTime(time)"
          >
            {{ time }}
          </button>
          <input
            class="custom"
            type="time"
            step="300"
            :value="timeOf(model)"
            :aria-label="t('common.picker.exactTime')"
            @change="pickTime(($event.target as HTMLInputElement).value)"
          />
        </div>
      </div>
      <button type="button" class="done" @click="close">{{ t('common.picker.done') }}</button>
    </div>
  </div>
</template>

<style scoped src="./date-time-picker.css"></style>
