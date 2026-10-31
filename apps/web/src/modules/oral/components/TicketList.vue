<script setup lang="ts">
import type { Question } from '@exam/contracts'

defineProps<{ questions: Question[] }>()
</script>

<template>
  <section class="ticket">
    <h2>Билет</h2>
    <ol>
      <li v-for="q in questions" :key="q.id">{{ q.text }}</li>
    </ol>
  </section>
</template>

<style scoped>
.ticket {
  display: grid;
  gap: var(--space-3);
}
ol {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding-inline-start: var(--space-5);
  font-size: var(--text-lg);
  line-height: 1.5;
}
</style>
