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
  if (!exam.finished) return 'Ответы сохранены'
  if (exam.endedBy === 'examiner') return 'Преподаватель завершил экзамен'
  if (exam.endedBy === 'time') return 'Время вышло'
  return 'Экзамен сдан'
})
const uploading = computed(() => sync.status.pendingChunks > 0)
</script>

<template>
  <main class="page">
    <AppCard tone="ink" class="hero">
      <CircleCheck :size="56" class="icon" aria-hidden="true" />
      <h1>{{ title }}</h1>
      <p v-if="!exam.finished" class="lead">
        Ответы сохранены на устройстве и отправятся, как только появится интернет. Не закрывайте эту страницу.
      </p>
      <p v-else class="lead">
        Засчитаны все ответы, данные до завершения. Результат появится после проверки преподавателем.
      </p>
    </AppCard>

    <AppCard v-if="exam.signedOut" role="alert" class="warn">
      Сессия входа закончилась.
      <RouterLink :to="`/login?next=${route.fullPath}`">Войдите снова</RouterLink>, чтобы отправить ответы.
    </AppCard>

    <AppCard v-else-if="exam.finished" role="status" aria-live="polite">
      <p v-if="uploading">
        Отправляем запись: осталось фрагментов — {{ sync.status.pendingChunks }}. Можно не ждать: загрузка
        продолжится при следующем входе.
      </p>
      <p v-else>Всё отправлено. Страницу можно закрыть.</p>
    </AppCard>

    <AppButton variant="ink" class="back" @click="$router.push('/exams')">К моим экзаменам</AppButton>
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
