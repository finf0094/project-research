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

<style scoped src="./done-page.css"></style>
