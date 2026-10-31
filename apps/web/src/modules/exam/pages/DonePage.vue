<script setup lang="ts">
import { CheckCircle2, CloudUpload, FileCheck2, WifiOff } from 'lucide-vue-next'
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSyncStore } from '@/modules/offline'
import { AppButton, IconTile } from '@/shared/ui'
import { useExamStore } from '../exam.store'

/**
 * After finishing: what is safe and what is still on its way. The page keeps the sync loop running so the
 * last answers and recordings reach the server; it can be closed once everything is sent.
 */
const route = useRoute()
const exam = useExamStore()
const sync = useSyncStore()
watch(
  () => String(route.params.attemptId),
  (id) => exam.open(id).catch(() => undefined),
  { immediate: true },
)
onUnmounted(() => exam.close())

const title = computed(() => {
  if (!exam.finished) return 'exam.done.saved'
  if (exam.endedBy === 'examiner') return 'exam.done.byExaminer'
  if (exam.endedBy === 'time') return 'exam.done.byTime'
  return 'exam.done.submitted'
})
const offline = computed(() => sync.status.connection === 'offline')
const pending = computed(() => sync.status.pendingEvents + sync.status.pendingChunks)
</script>

<template>
  <main class="page">
    <section class="card">
      <span class="badge" aria-hidden="true"><CheckCircle2 :size="40" /></span>
      <h1>{{ $t(title) }}</h1>
      <p class="lead">{{ $t(exam.finished ? 'exam.done.countedHint' : 'exam.done.savedHint') }}</p>

      <ul class="steps" role="status" aria-live="polite">
        <li>
          <IconTile :icon="FileCheck2" tone="ok" />
          <div>
            <p class="title">{{ $t('student.done.answers') }}</p>
            <p class="muted note">{{ $t('student.done.answersNote', { n: exam.answeredCount }) }}</p>
          </div>
          <span class="tick done" aria-hidden="true">✓</span>
        </li>
        <li>
          <IconTile :icon="offline ? WifiOff : CloudUpload" :tone="pending ? 'peach' : 'ok'" />
          <div>
            <p class="title">
              {{
                $t(
                  offline && pending
                    ? 'student.done.waiting'
                    : pending
                      ? 'student.done.sending'
                      : 'student.done.sent',
                )
              }}
            </p>
            <p class="muted note">
              {{
                offline && pending
                  ? $t('student.done.waitingNote')
                  : pending
                    ? $t('student.done.sendingNote', { n: sync.status.pendingChunks })
                    : $t('student.done.sentNote')
              }}
            </p>
          </div>
          <span class="tick" :class="{ done: !pending, busy: pending && !offline }" aria-hidden="true">{{
            pending ? '' : '✓'
          }}</span>
        </li>
      </ul>

      <i18n-t v-if="exam.signedOut" keypath="exam.done.signedOut" tag="p" class="warn" role="alert">
        <template #link>
          <RouterLink :to="`/login?next=${route.fullPath}`">{{ $t('exam.done.signIn') }}</RouterLink>
        </template>
      </i18n-t>
      <AppButton variant="ink" icon="arrow" to="/exams">{{ $t('exam.done.back') }}</AppButton>
    </section>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-4);
}
.card {
  position: relative;
  display: grid;
  gap: var(--space-4);
  justify-items: start;
  inline-size: min(560px, 100%);
  overflow: hidden;
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-2);
  animation: rise var(--dur-slow) var(--ease) both;
  &::after {
    content: '';
    position: absolute;
    inset-block-start: -40%;
    inset-inline-end: -30%;
    inline-size: 300px;
    aspect-ratio: 1;
    border: 1px dashed var(--border);
    border-radius: 50%;
  }
}
.badge {
  display: grid;
  place-items: center;
  inline-size: 72px;
  block-size: 72px;
  border-radius: var(--radius-lg);
  background: var(--lime);
  color: var(--on-lime);
  animation: pop 600ms var(--ease-spring) 120ms both;
}
@keyframes pop {
  from {
    scale: 0.4;
    opacity: 0;
    rotate: -12deg;
  }
}
h1 {
  font-size: var(--text-2xl);
}
.lead {
  color: var(--text-2);
}
.steps {
  display: grid;
  gap: var(--space-2);
  inline-size: 100%;
  padding: 0;
  list-style: none;
  li {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius);
    background: var(--surface-2);
  }
}
.title {
  font-weight: 700;
}
.note {
  font-size: var(--text-sm);
}
.tick {
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: 50%;
  border: 2px solid var(--border);
  color: var(--on-ok);
  font-size: var(--text-sm);
  &.done {
    border-color: var(--ok);
    background: var(--ok);
  }
  /* Sending: a ring that spins until the last fragment is on the server. */
  &.busy {
    border-color: var(--accent) transparent var(--accent) var(--accent);
    animation: spin 0.9s linear infinite;
  }
}
@keyframes spin {
  to {
    rotate: 1turn;
  }
}
.warn {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
}
</style>
