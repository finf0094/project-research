<script setup lang="ts">
import type { QuestionInput } from '@exam/contracts'

/**
 * The selected question as the student will see it, updating while the examiner types. Correct answers
 * are not marked (the student never sees them).
 */
defineProps<{ question: QuestionInput; index: number }>()
const LETTERS = 'ABCDEFGHIJKL'
</script>

<template>
  <aside class="preview" :aria-label="$t('authoring.preview.title')">
    <header>
      <span>{{ $t('authoring.preview.title') }}</span>
      <span class="tag">{{ $t('authoring.preview.tag') }}</span>
    </header>
    <div class="screen">
      <p class="meta">
        <b>{{ String(index + 1).padStart(2, '0') }}</b>
        <span>{{ $t(`exam.question.type.${question.type}`) }}</span>
      </p>
      <p class="text">{{ question.text || $t('authoring.questions.untitled') }}</p>
      <ul v-if="question.type !== 'text'" class="options">
        <li v-for="(option, i) in question.options" :key="option.id">
          <span class="letter">{{ LETTERS[i] }}</span
          >{{ option.text || '…' }}
        </li>
      </ul>
      <p v-else class="answer">{{ $t('exam.question.placeholder') }}</p>
    </div>
    <p class="note">{{ $t('authoring.preview.note') }}</p>
  </aside>
</template>

<style scoped>
.preview {
  display: grid;
  gap: var(--space-3);
  align-content: start;
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: var(--on-ink);
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--text-sm);
  font-weight: 700;
}
.tag {
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--on-ink-tint-2);
  font-size: var(--text-xs);
  font-weight: 600;
}
.screen {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
}
.meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  b {
    color: var(--accent);
    font-family: var(--font-display);
    font-size: var(--text-xl);
  }
  span {
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--accent-tint);
    color: var(--accent-ink);
    font-weight: 600;
  }
}
.text {
  overflow-wrap: anywhere;
  font-size: var(--text-sm);
  font-weight: 700;
}
.options {
  display: grid;
  gap: var(--space-1);
  padding: 0;
  list-style: none;
  li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    font-size: var(--text-xs);
    font-weight: 600;
    overflow-wrap: anywhere;
  }
}
.letter {
  display: grid;
  place-items: center;
  flex: none;
  inline-size: 22px;
  block-size: 22px;
  border-radius: 50%;
  background: var(--surface);
  font-size: 10px;
}
.answer {
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-2);
  font-size: var(--text-xs);
}
.note {
  color: var(--on-ink-2);
  font-size: var(--text-xs);
}
</style>
