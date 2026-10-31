<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { DeviceCheck } from '@/modules/proctoring'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, AppCard, CheckList, LocaleSwitch } from '@/shared/ui'
import { beginAttempt } from '../local-attempt'
import { runBrowserChecks, type Check } from '../preflight'
import { attemptPath } from '../paths'

const route = useRoute()
const router = useRouter()
const checks = ref<Check[] | null>(null)
const consent = ref(false)
const deviceReady = ref(false)
const starting = useAction({ 409: 'exam.preflight.notOpen' as const })

onMounted(async () => (checks.value = await runBrowserChecks()))
const { t } = useI18n()
const items = computed(() =>
  (checks.value ?? []).map((c) => ({
    id: c.id,
    ok: c.ok,
    title: t(`exam.preflight.${c.id}.title`),
    hint: c.advise ? t(`exam.preflight.${c.id}.hint`) : undefined,
  })),
)
const FACTS = ['answers', 'video', 'server', 'decision'] as const
const ready = computed(() => !!checks.value?.every((c) => c.ok) && deviceReady.value && consent.value)

const start = () =>
  starting.run(async () => {
    const attempt = await beginAttempt(String(route.params.examId))
    await router.replace(attemptPath(attempt.id, attempt.exam.profile.mode))
  })
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
        <CheckList v-else :items="items" />
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
        <AppButton block :disabled="!ready" :loading="starting.busy.value" @click="start">{{
          $t('exam.preflight.start')
        }}</AppButton>
        <p v-if="starting.error.value" class="error" role="alert">{{ $t(starting.error.value) }}</p>
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
.hint {
  font-size: var(--text-sm);
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
