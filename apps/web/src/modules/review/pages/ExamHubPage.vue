<script setup lang="ts">
import { onScopeDispose, ref } from 'vue'
import { useRoute } from 'vue-router'
import HubHeader from '../components/HubHeader.vue'
import { provideExamHub } from '../exam-hub'

/**
 * The page of one exam: a header with its sections, the current section below. The exam and its attempts
 * are loaded once here, kept live, and shared with every section.
 */
const route = useRoute()
const hub = provideExamHub(String(route.params.examId))
// Countdowns and "x s ago" tick with this clock.
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 1000)
onScopeDispose(() => clearInterval(clock))
</script>

<template>
  <main class="hub">
    <HubHeader v-if="hub.exam.value" :exam="hub.exam.value" :now="now" />
    <p v-if="hub.stale.value" class="stale" role="status">{{ $t('review.monitoring.stale') }}</p>
    <RouterView v-if="hub.exam.value" v-slot="{ Component }">
      <div :key="String(route.name)" class="section"><component :is="Component" :now="now" /></div>
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
.stale {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
  font-size: var(--text-sm);
}
</style>
