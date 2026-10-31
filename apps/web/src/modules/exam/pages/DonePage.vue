<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next'
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useSyncStore } from '@/modules/offline'
import { AppButton, AppCard } from '@/shared/ui'
import { useExamStore } from '../exam.store'

const route = useRoute()
const exam = useExamStore()
const sync = useSyncStore()

// Keeps the sync loop running so the remaining answers and recordings reach the server.
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
const uploading = computed(() => sync.status.pendingChunks > 0)
</script>

<template>
  <main class="page">
    <AppCard tone="ink" class="hero">
      <CircleCheck :size="56" class="icon" aria-hidden="true" />
      <h1>{{ $t(title) }}</h1>
      <p class="lead">{{ $t(exam.finished ? 'exam.done.countedHint' : 'exam.done.savedHint') }}</p>
    </AppCard>

    <AppCard v-if="exam.signedOut" role="alert" class="warn">
      <i18n-t keypath="exam.done.signedOut" tag="span">
        <template #link>
          <RouterLink :to="`/login?next=${route.fullPath}`">{{ $t('exam.done.signIn') }}</RouterLink>
        </template>
      </i18n-t>
    </AppCard>

    <AppCard v-else-if="exam.finished" role="status" aria-live="polite">
      <p v-if="uploading">{{ $t('exam.done.uploading', { n: sync.status.pendingChunks }) }}</p>
      <p v-else>{{ $t('exam.done.allSent') }}</p>
    </AppCard>

    <AppButton variant="ink" class="back" @click="$router.push('/exams')">{{
      $t('exam.done.back')
    }}</AppButton>
  </main>
</template>

<style scoped>
.page {
  display: grid;
  gap: var(--space-4);
  width: min(560px, 100%);
  margin: var(--space-12) auto;
  padding-inline: var(--space-4);
}
.hero {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-8);
}
.icon {
  color: var(--lime);
}
.lead {
  color: var(--on-ink-2);
}
.warn {
  background: var(--warn-tint);
  color: var(--warn);
}
.back {
  justify-self: start;
}
</style>
