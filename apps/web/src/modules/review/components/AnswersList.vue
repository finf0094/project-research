<script setup lang="ts">
import type { ReviewedAnswer } from '@exam/contracts'

defineProps<{ answers: ReviewedAnswer[] }>()

function show(a: ReviewedAnswer) {
  if (a.value === null) return 'Нет ответа'
  const byId = new Map(a.question.options.map((o) => [o.id, o.text]))
  return Array.isArray(a.value)
    ? a.value.map((id) => byId.get(id) ?? id).join(', ')
    : (byId.get(a.value) ?? a.value)
}
</script>

<template>
  <ol class="answers">
    <li v-for="a in answers" :key="a.question.id" class="answer">
      <div class="head">
        <p class="question">{{ a.question.text }}</p>
        <span class="score">{{
          a.autoScore === null ? 'вручную' : `${a.autoScore}/${a.question.points}`
        }}</span>
      </div>
      <p class="value" :class="{ muted: a.value === null }">{{ show(a) }}</p>
    </li>
  </ol>
</template>

<style scoped>
.answers {
  display: grid;
  gap: var(--space-3);
  padding-inline-start: var(--space-5);
}
.answer {
  display: grid;
  gap: var(--space-1);
}
.head {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
}
.question {
  font-weight: 600;
}
.score {
  font-family: var(--font-display);
  white-space: nowrap;
}
.value {
  white-space: pre-wrap;
}
</style>
