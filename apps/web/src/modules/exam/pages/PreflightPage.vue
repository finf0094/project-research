<script setup lang="ts">
import type { StudentExamListItem } from '@exam/contracts'
import { ArrowLeft, Timer } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth'
import { CameraStage, useDeviceProbe } from '@/modules/proctoring'
import { AppButton, LocaleSwitch } from '@/shared/ui'
import { listExams } from '../api'
import CameraHelp from '../components/CameraHelp.vue'
import CheckCard from '../components/CheckCard.vue'
import DataConsent from '../components/DataConsent.vue'
import PreflightSteps from '../components/PreflightSteps.vue'
import OfflineStartCard from '../components/OfflineStartCard.vue'
import { usePreflightChecks } from '../preflight-checks'
import { useExamStart } from '../use-exam-start'

/**
 * Before the exam: the camera with a guide to sit right, every check in one list, what happens to the
 * data and the consent. Starting is possible once all pass; the button says what is still missing.
 */
const route = useRoute()
const router = useRouter()
const examId = String(route.params.examId)
const probe = useDeviceProbe()
const { checks, ready } = usePreflightChecks(probe)
const consent = ref(false)
const { starting, start, pkg, offline, unlocking, codeError, startWithCode } = useExamStart(
  examId,
  useAuthStore().user!.id,
)

// The title is a courtesy: the check works without it.
const exam = ref<StudentExamListItem | null>(null)
onMounted(() => {
  void probe.start()
  listExams()
    .then((list) => (exam.value = list.find((e) => e.id === examId) ?? null))
    .catch(() => {})
})

/** The heading follows the state: getting ready, something to fix, or all set. */
const heading = computed(() =>
  ready.value
    ? 'ready'
    : checks.value.some((c) => c.status === 'bad' && c.id !== 'online')
      ? 'fix'
      : 'prepare',
)
const step = computed(() => (!ready.value ? 0 : !consent.value ? 1 : 2))
const startLabel = computed(
  () => ['exam.preflight.needChecks', 'exam.preflight.needConsent', 'exam.preflight.start'][step.value]!,
)
</script>

<template>
  <main class="page">
    <header class="top">
      <AppButton
        variant="secondary"
        class="back"
        :aria-label="$t('common.back')"
        @click="router.push('/exams')"
        ><ArrowLeft :size="20"
      /></AppButton>
      <span class="exam">{{ exam?.title ?? pkg?.title }}</span>
      <PreflightSteps :current="step" class="steps" />
      <LocaleSwitch />
    </header>
    <Transition name="rise" mode="out-in">
      <h1 :key="heading">{{ $t(`exam.preflight.titles.${heading}`) }}</h1>
    </Transition>

    <div class="grid">
      <CameraStage
        class="camera"
        :state="probe.state.value"
        :stream="probe.stream.value"
        :faces="probe.faces.value"
        :placed="probe.placed.value"
        :facing="probe.facing.value"
        :brightness="probe.brightness.value"
        @retry="probe.start"
      />
      <CheckCard class="side" :checks="checks" />
      <div class="start">
        <!-- No network at the start, but the package is here: the proctor's code begins the exam. -->
        <OfflineStartCard
          v-if="offline && step === 2"
          :busy="unlocking"
          :error="codeError"
          @start="startWithCode"
        />
        <AppButton
          v-else
          block
          :icon="step === 2 ? 'arrow' : undefined"
          :disabled="step < 2"
          :loading="starting.busy.value"
          @click="start"
          >{{ $t(startLabel) }}</AppButton
        >
        <p v-if="starting.error.value" class="error" role="alert">{{ $t(starting.error.value) }}</p>
      </div>
      <CameraHelp v-if="probe.state.value === 'blocked' && probe.denied.value" class="help" />
      <p v-else class="timer"><Timer :size="18" aria-hidden="true" /> {{ $t('exam.preflight.timerHint') }}</p>
      <DataConsent v-model="consent" class="data" />
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-5);
  inline-size: min(1120px, 100%);
  margin-inline: auto;
  padding: var(--space-6) var(--space-4) var(--space-12);
}
.top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3) var(--space-4);
}
.back {
  inline-size: 44px;
  padding: 0;
  border-radius: 50%;
}
.exam {
  font-weight: 700;
}
.steps {
  margin-inline-start: auto;
}
h1 {
  font-size: clamp(var(--text-2xl), 4vw, var(--text-3xl));
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 1fr);
  grid-template-areas:
    'camera side'
    'timer side'
    'data side'
    'data start';
  grid-template-rows: auto auto 1fr auto;
  gap: var(--space-4);
  align-items: start;
}
.camera {
  grid-area: camera;
}
.timer,
.help {
  grid-area: timer;
}
.data {
  grid-area: data;
}
.side {
  grid-area: side;
}
/* Next to the consent's end: agreeing and starting are one motion. */
.start {
  display: grid;
  grid-area: start;
  gap: var(--space-3);
  align-self: end;
}
.timer {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  color: var(--text-2);
  font-size: var(--text-sm);
}
.error {
  color: var(--danger);
}
@media (width < 900px) {
  .grid {
    grid-template-columns: 1fr;
    grid-template-areas: 'camera' 'side' 'timer' 'data' 'start';
    grid-template-rows: none;
  }
  .steps {
    order: 1;
    inline-size: 100%;
    margin: 0;
  }
}
</style>
