<script setup lang="ts">
import type { DecisionBody, Verdict } from '@exam/contracts'
import { computed, ref } from 'vue'
import { AppButton } from '@/shared/ui'

const props = defineProps<{
  current: { verdict: Verdict; comment: string; score: number | null } | null
  saving: boolean
  /**
   * Oral exams and free-text answers have no automatic total: the examiner gives the score, and
   * accepting the work needs it.
   */
  withScore?: boolean
}>()
const emit = defineEmits<{ save: [body: DecisionBody] }>()

// No verdict is preselected: the examiner has to choose consciously.
const verdict = ref<Verdict | null>(props.current?.verdict ?? null)
const comment = ref(props.current?.comment ?? '')
const score = ref<number | ''>(props.current?.score ?? '')

/** The server refuses to accept open answers without a score; other verdicts may leave it for later. */
const scoreRequired = computed(() => props.withScore && verdict.value === 'clean')

function submit() {
  if (!verdict.value) return
  emit('save', {
    verdict: verdict.value,
    comment: comment.value,
    score: props.withScore && score.value !== '' ? score.value : null,
  })
}

const VERDICTS: Verdict[] = ['clean', 'violation', 'needs_review']
</script>

<template>
  <form class="form" @submit.prevent="submit">
    <fieldset class="verdicts">
      <legend>{{ $t('review.decision.title') }}</legend>
      <label v-for="v in VERDICTS" :key="v" class="verdict" :class="{ checked: verdict === v }">
        <input v-model="verdict" type="radio" name="verdict" :value="v" />
        {{ $t(`review.decision.${v}`) }}
      </label>
    </fieldset>
    <label v-if="withScore" class="field">
      {{ $t('review.decision.score') }}
      <input v-model.number="score" type="number" min="0" max="100" step="1" :required="scoreRequired" />
    </label>
    <label class="field">
      {{ $t('review.decision.comment') }}
      <textarea
        v-model="comment"
        rows="4"
        maxlength="5000"
        :placeholder="$t('review.decision.commentPlaceholder')"
        aria-describedby="comment-note"
      />
      <span id="comment-note" class="note">{{ $t('review.decision.commentNote') }}</span>
    </label>
    <AppButton type="submit" block :disabled="!verdict" :loading="saving">{{
      $t('review.decision.save')
    }}</AppButton>
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
.field {
  display: grid;
  gap: var(--space-2);
  font-size: var(--text-sm);
  font-weight: 600;
}
.note {
  color: var(--text-2);
  font-weight: 400;
}
textarea,
input[type='number'] {
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  font-weight: 400;
}
</style>
