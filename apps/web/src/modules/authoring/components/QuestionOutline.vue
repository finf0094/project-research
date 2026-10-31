<script setup lang="ts">
import type { QuestionInput, QuestionType } from '@exam/contracts'
import { Plus } from 'lucide-vue-next'
import { TYPE_ICON } from '@/modules/exam'

/**
 * The exam's questions as a short list to move between: number, type, the start of the text, points,
 * and a dot on those that still need fixing. New questions are added here.
 */
defineProps<{
  questions: QuestionInput[]
  /** Stable keys that move with their questions, so a moved question glides to its new place. */
  keys: string[]
  selected: number
  issues: Set<number>
  types: readonly QuestionType[]
  disabled: boolean
}>()
defineEmits<{ select: [index: number]; add: [type: QuestionType] }>()
</script>

<template>
  <nav class="outline" :aria-label="$t('authoring.questions.title')">
    <header>
      <h2>{{ $t('authoring.questions.title') }}</h2>
      <span v-if="issues.size" class="issues">{{ $t('authoring.questions.toFix', { n: issues.size }) }}</span>
    </header>
    <TransitionGroup tag="ol" name="list" class="items">
      <li v-for="(q, i) in questions" :key="keys[i]">
        <button
          type="button"
          class="item"
          :class="{ current: i === selected, issue: issues.has(i) }"
          :aria-current="i === selected ? 'step' : undefined"
          @click="$emit('select', i)"
        >
          <span class="icon" aria-hidden="true"><component :is="TYPE_ICON[q.type]" :size="16" /></span>
          <span class="text">
            <span class="meta"
              >{{ String(i + 1).padStart(2, '0') }} · {{ $t(`exam.question.type.${q.type}`) }}</span
            >
            <span class="preview">{{ q.text || $t('authoring.questions.untitled') }}</span>
          </span>
          <span class="points">{{ $t('exam.question.points', { n: q.points }) }}</span>
          <span v-if="issues.has(i)" class="visually-hidden">{{ $t('authoring.questions.needsFix') }}</span>
        </button>
      </li>
    </TransitionGroup>
    <div v-if="!disabled" class="add">
      <button v-for="type in types" :key="type" type="button" @click="$emit('add', type)">
        <Plus :size="14" aria-hidden="true" /> {{ $t(`exam.question.type.${type}`) }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.outline {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  h2 {
    font-size: var(--text-lg);
  }
}
.issues {
  color: var(--warn);
  font-size: var(--text-xs);
  font-weight: 600;
}
.items {
  position: relative;
  display: grid;
  gap: var(--space-1);
  padding: 0;
  list-style: none;
}
.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  inline-size: 100%;
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius);
  background: none;
  color: var(--text);
  text-align: start;
  transition: background-color var(--dur) var(--ease);
  &:hover {
    background: var(--surface-2);
  }
  &.current {
    background: var(--ink);
    color: var(--on-ink);
    .meta,
    .points {
      color: var(--on-ink-2);
    }
  }
  &.issue::after {
    content: '';
    position: absolute;
    inset: 6px auto auto 6px;
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    background: var(--warn);
  }
}
.icon {
  display: grid;
  place-items: center;
  flex: none;
  inline-size: 32px;
  block-size: 32px;
  border-radius: var(--radius-sm);
  background: var(--accent-tint);
  color: var(--accent-ink);
}
.text {
  display: grid;
  flex: 1;
  min-inline-size: 0;
}
.meta,
.points {
  color: var(--text-2);
  font-size: var(--text-xs);
}
.preview {
  overflow: hidden;
  font-size: var(--text-sm);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.add {
  display: grid;
  gap: var(--space-1);
  button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border: 1px dashed var(--border);
    border-radius: var(--radius);
    background: none;
    color: var(--accent-ink);
    font-size: var(--text-sm);
    font-weight: 600;
    transition: background-color var(--dur) var(--ease);
    &:hover {
      background: var(--accent-tint);
    }
  }
}
</style>
