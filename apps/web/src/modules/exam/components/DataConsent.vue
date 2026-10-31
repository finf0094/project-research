<script setup lang="ts">
/** What happens to the student's data, as numbered plain facts, and the consent to it. */
const consent = defineModel<boolean>({ required: true })
const FACTS = ['answers', 'video', 'server', 'decision'] as const
</script>

<template>
  <section class="card">
    <h2>{{ $t('exam.preflight.dataTitle') }}</h2>
    <ol>
      <li v-for="(fact, i) in FACTS" :key="fact">
        <span class="n" aria-hidden="true">{{ String(i + 1).padStart(2, '0') }}</span>
        <span>
          <strong>{{ $t(`exam.preflight.${fact}`) }}</strong>
          <span class="text">{{ $t(`exam.preflight.${fact}Text`) }}</span>
        </span>
      </li>
    </ol>
    <label class="consent" :class="{ checked: consent }">
      <input v-model="consent" type="checkbox" />
      {{ $t('exam.preflight.consent') }}
    </label>
  </section>
</template>

<style scoped>
.card {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border-radius: var(--radius-lg);
  background: var(--accent-tint);
}
h2 {
  font-size: var(--text-lg);
}
ol {
  display: grid;
  gap: var(--space-4);
  padding: 0;
  list-style: none;
}
li {
  display: flex;
  gap: var(--space-4);
  > span:last-child {
    display: grid;
    gap: 2px;
  }
}
.n {
  min-inline-size: 1.6em;
  color: var(--accent-ink);
  font-family: var(--font-display);
  font-weight: 700;
}
.text {
  color: var(--text-2);
  font-size: var(--text-sm);
}
.consent {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 2px solid transparent;
  border-radius: var(--radius);
  background: var(--surface);
  font-weight: 600;
  cursor: pointer;
  transition: border-color var(--dur) var(--ease);
  &.checked {
    border-color: var(--accent);
  }
  input {
    inline-size: 20px;
    block-size: 20px;
    accent-color: var(--accent);
  }
}
</style>
