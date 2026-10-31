<script setup lang="ts">
import { useRoute } from 'vue-router'
import HubHeader from '../components/HubHeader.vue'
import { provideExamHub } from '../exam-hub'

/**
 * The page of one exam: a header with its sections, the current section below. The exam and its attempts
 * are loaded once here, kept live, and shared with every section.
 */
const route = useRoute()
const hub = provideExamHub(String(route.params.examId))
</script>

<template>
  <main class="hub">
    <p v-if="hub.missing.value" class="missing" role="alert">
      {{ $t('hub.missing') }} <RouterLink to="/examiner">{{ $t('review.exams.title') }}</RouterLink>
    </p>
    <HubHeader
      v-if="hub.exam.value"
      :exam="hub.exam.value"
      :now="hub.now.value"
      :live="hub.live.value"
      :stale="hub.stale.value"
    />
    <RouterView v-if="hub.exam.value" v-slot="{ Component }">
      <div :key="String(route.name)" class="section"><component :is="Component" /></div>
    </RouterView>
  </main>
</template>

<style scoped>
.hub {
  display: grid;
  gap: var(--space-4);
}
.section {
  animation: rise var(--dur-slow) var(--ease) both;
}
.missing {
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  a {
    color: var(--accent-ink);
    font-weight: 600;
  }
}
</style>
