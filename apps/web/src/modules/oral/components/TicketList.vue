<script setup lang="ts">
import type { Question } from '@exam/contracts'

/** The drawn ticket: its questions as large numbered cards, readable at a glance during the talk. */
defineProps<{ questions: Question[] }>()
</script>

<template>
  <section class="ticket">
    <h2>{{ $t('oral.ticket') }}</h2>
    <ol class="stagger">
      <li v-for="(q, i) in questions" :key="q.id">
        <span class="n" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="text">{{ q.text }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.ticket {
  display: grid;
  gap: var(--space-3);
  h2 {
    font-size: var(--text-lg);
  }
}
ol {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
}
.n {
  color: var(--accent);
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 700;
  line-height: 1.1;
}
.text {
  font-size: var(--text-md);
  font-weight: 600;
  line-height: 1.45;
}
</style>
