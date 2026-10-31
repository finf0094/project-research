<script setup lang="ts">
import type { DecisionBody, Verdict } from '@exam/contracts'
import { ref } from 'vue'
import { AppButton } from '@/shared/ui'

const props = defineProps<{ current: { verdict: Verdict; comment: string } | null; saving: boolean }>()
const emit = defineEmits<{ save: [body: DecisionBody] }>()

// No verdict is preselected: the examiner has to choose consciously.
const verdict = ref<Verdict | null>(props.current?.verdict ?? null)
const comment = ref(props.current?.comment ?? '')

const OPTIONS: { value: Verdict; text: string }[] = [
  { value: 'clean', text: 'Нарушений не выявлено' },
  { value: 'violation', text: 'Нарушение подтверждено' },
  { value: 'needs_review', text: 'Нужна дополнительная проверка' },
]
</script>

<template>
  <form class="form" @submit.prevent="verdict && emit('save', { verdict, comment })">
    <fieldset class="verdicts">
      <legend>Решение</legend>
      <label v-for="o in OPTIONS" :key="o.value" class="verdict" :class="{ checked: verdict === o.value }">
        <input v-model="verdict" type="radio" name="verdict" :value="o.value" />
        {{ o.text }}
      </label>
    </fieldset>
    <label class="comment">
      Комментарий
      <textarea
        v-model="comment"
        rows="4"
        maxlength="5000"
        placeholder="Что вы увидели и почему так решили"
      />
    </label>
    <AppButton type="submit" block :disabled="!verdict" :loading="saving">Сохранить решение</AppButton>
  </form>
</template>

<style scoped>
.form,
.verdicts {
  display: grid;
  gap: var(--space-3);
}
.verdicts {
  padding: 0;
  border: 0;
}
legend {
  margin-bottom: var(--space-2);
  font-family: var(--font-display);
  font-size: var(--text-lg);
}
.verdict {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--surface-2);
  font-weight: 600;
  cursor: pointer;

  &.checked {
    background: var(--accent-tint);
    color: var(--accent-ink);
  }
  input {
    accent-color: var(--accent);
  }
}
.comment {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
textarea {
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-weight: 400;
}
</style>
