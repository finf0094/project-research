<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { computed } from 'vue'
import { CameraPreview } from '@/modules/proctoring'
import { AppButton, AppCard } from '@/shared/ui'
import ExamLayout from '../components/ExamLayout.vue'
import QuestionNav from '../components/QuestionNav.vue'
import QuestionView from '../components/QuestionView.vue'
import { useAttemptPage } from '../use-attempt-page'

const { exam, attemptId, loadError, confirming, open, finish } = useAttemptPage('written')
const unanswered = computed(() => exam.questions.length - exam.answeredCount)
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
          @answer="exam.answer(exam.question.id, $event)"
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
          <AppButton v-if="exam.current < exam.questions.length - 1" @click="exam.goTo(exam.current + 1)">
            {{ $t('exam.page.next') }} <ArrowRight :size="20" />
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
  gap: var(--space-8);
  padding: var(--space-8);
  /* Comfortable reading width for the question; the card itself fills the column. */
  & > * {
    max-inline-size: 880px;
  }
}
.pager {
  display: flex;
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
</style>
