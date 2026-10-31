<script setup lang="ts">
import { CircleCheck } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSyncStore } from '@/modules/offline'
import { AppButton, AppCard } from '@/shared/ui'
import { useExamStore } from '../exam.store'

const route = useRoute()
const exam = useExamStore()
const sync = useSyncStore()

// Keeps the sync loop running so the remaining answers and recordings reach the server.
onMounted(() => exam.open(String(route.params.attemptId)))
onUnmounted(() => exam.close())

const answersOnDevice = computed(() => !exam.finished)
const uploading = computed(() => sync.status.pendingChunks > 0)
</script>

<template>
  <main class="page">
    <AppCard tone="ink" class="hero">
      <CircleCheck :size="56" class="icon" aria-hidden="true" />
      <h1>{{ answersOnDevice ? 'Ответы сохранены' : 'Экзамен сдан' }}</h1>
      <p v-if="answersOnDevice" class="lead">
        Ответы сохранены на устройстве и отправятся, как только появится интернет. Не закрывайте эту страницу.
      </p>
      <p v-else class="lead">
        Ответы получены, экзамен засчитан. Результат появится после проверки преподавателем.
      </p>
    </AppCard>

    <AppCard v-if="!answersOnDevice" role="status" aria-live="polite">
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
  color: rgb(255 255 255 / 0.75);
}
.back {
  justify-self: start;
}
</style>
