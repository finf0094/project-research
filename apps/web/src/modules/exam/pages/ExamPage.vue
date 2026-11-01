<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next'
import { computed, watch } from 'vue'
import { CameraPreview } from '@/modules/proctoring'
import { AppButton, AppCard } from '@/shared/ui'
import ExamLayout from '../components/ExamLayout.vue'
import QuestionNav from '../components/QuestionNav.vue'
import QuestionView from '../components/QuestionView.vue'
import AnswerStatus from '../components/AnswerStatus.vue'
import QuestionTools from '../components/QuestionTools.vue'
import { isAnswered } from '../answers'
import { useFlags, useTextSize } from '../reading'
import { useAttemptPage } from '../use-attempt-page'

/** A written exam: the questions on the left, the current one on the right, saved as the student goes. */
const { exam, attemptId, loadError, confirming, open, finish } = useAttemptPage('written')
const unanswered = computed(() => exam.questions.length - exam.answeredCount)
const { size, scale } = useTextSize()
// The page is remounted for every attempt (App keys pages by their parameters), so one id per page.
const flags = useFlags(attemptId.value)
watch(
  () => exam.locked,
  (locked) => locked && flags.forget(),
)
const last = computed(() => exam.current === exam.questions.length - 1)
</script>

<template>
  <ExamLayout
    v-model:confirming="confirming"
    :attempt-id="attemptId"
    :step="$t('exam.header.step', { n: exam.current + 1, total: exam.questions.length })"
    :load-error="loadError"
    :unanswered="unanswered"
    @retry="open(attemptId)"
    @finish="finish"
  >
    <div v-if="exam.question" class="body">
      <AppCard as="aside" class="side">
        <QuestionNav
          :questions="exam.questions"
          :answers="exam.answers"
          :current="exam.current"
          :flagged="flags.flagged.value"
          @select="exam.goTo"
        />
        <CameraPreview />
      </AppCard>

      <AppCard class="main" @focusout="exam.saveNow">
        <QuestionView
          :key="exam.question.id"
          :question="exam.question"
          :index="exam.current"
          :value="exam.answers[exam.question.id]"
          :scale="scale"
          @answer="exam.answer(exam.question.id, $event)"
        >
          <template #tools>
            <QuestionTools
              v-model:size="size"
              :flagged="flags.has(exam.question.id)"
              @flag="flags.toggle(exam.question!.id)"
            />
          </template>
        </QuestionView>
        <AnswerStatus
          :answered="isAnswered(exam.answers[exam.question.id])"
          :saved-at="exam.savedAt[exam.question.id]"
          :failed="exam.failedOn.includes(exam.question.id)"
          :locked="exam.locked"
          @clear="exam.clear(exam.question!.id)"
        />
        <footer class="pager">
          <AppButton
            variant="secondary"
            :disabled="exam.current === 0"
            :aria-label="$t('exam.page.previous')"
            @click="exam.goTo(exam.current - 1)"
          >
            <ArrowLeft :size="20" />
          </AppButton>
          <AppButton v-if="!last" icon="arrow" @click="exam.goTo(exam.current + 1)">
            {{ $t('exam.page.next') }}
          </AppButton>
          <AppButton v-else variant="ink" @click="confirming = true">{{ $t('exam.page.finish') }}</AppButton>
        </footer>
      </AppCard>
    </div>
  </ExamLayout>
</template>

<style scoped>
.body {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.side {
  display: grid;
  gap: var(--space-6);
  position: sticky;
  top: var(--space-4);
}
.main {
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: var(--space-5);
  min-block-size: min(720px, 80dvh);
  padding: var(--space-8);
  /* Comfortable reading width for the question; the card itself fills the column. */
  & > * {
    max-inline-size: 880px;
  }
}
.pager {
  display: flex;
  align-self: end;
  justify-content: space-between;
  gap: var(--space-3);
}
@media (width < 900px) {
  .body {
    grid-template-columns: 1fr;
  }
  /* The question comes first on small screens; navigation follows. */
  .main {
    order: -1;
    padding: var(--space-5);
  }
  .side {
    position: static;
  }
}
/*
 * Phones: back and next stay at the thumb, on a frosted bar above the home indicator, as in an app;
 * the answer scrolls under it.
 */
@media (width < 700px) {
  .main {
    padding: var(--space-4);
  }
  .pager {
    position: sticky;
    z-index: 5;
    inset-block-end: 0;
    margin: 0 calc(-1 * var(--space-4)) calc(-1 * var(--space-4));
    padding: var(--space-3) var(--space-4) max(var(--space-3), env(safe-area-inset-bottom));
    border-top: 1px solid var(--border);
    border-radius: 0 0 var(--radius-lg) var(--radius-lg);
    background: color-mix(in oklab, var(--surface) 86%, transparent);
    backdrop-filter: blur(16px) saturate(1.5);
    & > :last-child {
      flex: 1;
    }
  }
}
</style>
