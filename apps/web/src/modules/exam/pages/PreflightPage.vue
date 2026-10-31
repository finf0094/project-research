<script setup lang="ts">
import { ArrowLeft, CircleCheck, CircleAlert } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DeviceCheck } from '@/modules/proctoring'
import { errorKey, type ErrorKey } from '@/shared/lib/error-key'
import { AppButton, AppCard, LocaleSwitch } from '@/shared/ui'
import { beginAttempt } from '../local-attempt'
import { runBrowserChecks, type Check } from '../preflight'
import { attemptPath } from '../paths'

const route = useRoute()
const router = useRouter()
const checks = ref<Check[] | null>(null)
const consent = ref(false)
const deviceReady = ref(false)
const starting = ref(false)
const error = ref<ErrorKey | 'exam.preflight.notOpen' | null>(null)

onMounted(async () => (checks.value = await runBrowserChecks()))
const FACTS = ['answers', 'video', 'server', 'decision'] as const
const ready = computed(() => !!checks.value?.every((c) => c.ok) && deviceReady.value && consent.value)

async function start() {
  error.value = null
  starting.value = true
  try {
    const attempt = await beginAttempt(String(route.params.examId))
    await router.replace(attemptPath(attempt.id, attempt.exam.profile.mode))
  } catch (e) {
    error.value = errorKey(e, { 409: 'exam.preflight.notOpen' as const })
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <main class="page">
    <header class="top">
      <AppButton variant="secondary" :aria-label="$t('common.back')" @click="router.push('/exams')"
        ><ArrowLeft :size="20"
      /></AppButton>
      <h1>{{ $t('exam.preflight.title') }}</h1>
      <LocaleSwitch class="locale" />
    </header>

    <div class="grid">
      <AppCard>
        <h2>{{ $t('exam.preflight.checks') }}</h2>
        <DeviceCheck class="device" @ready="deviceReady = $event" />
        <p v-if="!checks" class="muted">{{ $t('exam.preflight.checking') }}</p>
        <ul v-else class="checks">
          <li v-for="check in checks" :key="check.id" class="check">
            <CircleCheck v-if="check.ok" class="ok" :size="22" aria-hidden="true" />
            <CircleAlert v-else class="bad" :size="22" aria-hidden="true" />
            <div>
              <p class="title">{{ $t(`exam.preflight.${check.id}.title`) }}</p>
              <p v-if="check.advise" class="muted hint">{{ $t(`exam.preflight.${check.id}.hint`) }}</p>
            </div>
          </li>
        </ul>
        <p class="muted hint">{{ $t('exam.preflight.timerHint') }}</p>
      </AppCard>

      <AppCard tone="tint" class="privacy">
        <h2>{{ $t('exam.preflight.dataTitle') }}</h2>
        <ol class="facts">
          <li v-for="fact in FACTS" :key="fact">
            <strong>{{ $t(`exam.preflight.${fact}`) }}</strong> {{ $t(`exam.preflight.${fact}Text`) }}
          </li>
        </ol>
        <label class="consent">
          <input v-model="consent" type="checkbox" />
          {{ $t('exam.preflight.consent') }}
        </label>
        <AppButton block :disabled="!ready" :loading="starting" @click="start">{{
          $t('exam.preflight.start')
        }}</AppButton>
        <p v-if="error" class="error" role="alert">{{ $t(error) }}</p>
      </AppCard>
    </div>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-6);
  width: min(1120px, 100%);
  margin-inline: auto;
  padding: var(--space-8) var(--space-4);
}
.top {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
.locale {
  margin-inline-start: auto;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: var(--space-4);
  align-items: start;
}
.device {
  margin-top: var(--space-4);
}
.checks {
  display: grid;
  gap: var(--space-4);
  margin-block: var(--space-5);
  padding: 0;
  list-style: none;
}
.check {
  display: flex;
  gap: var(--space-3);
}
.title {
  font-weight: 600;
}
.hint {
  font-size: var(--text-sm);
}
.ok {
  color: var(--ok);
}
.bad {
  color: var(--warn);
}
.privacy {
  display: grid;
  gap: var(--space-4);
}
.facts {
  display: grid;
  gap: var(--space-3);
  padding-inline-start: var(--space-5);
  font-size: var(--text-sm);
}
.consent {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--surface);
  font-weight: 600;
  cursor: pointer;

  input {
    width: 20px;
    height: 20px;
    accent-color: var(--accent);
  }
}
.error {
  color: var(--danger);
}
</style>
