<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CameraPreview, HintBanner } from '@/modules/proctoring'
import { AppButton, AppCard } from '@/shared/ui'
import ExamHeader from '../components/ExamHeader.vue'
import ExaminerMessage from '../components/ExaminerMessage.vue'
import ExamNotices from '../components/ExamNotices.vue'
import ExamUnavailable from '../components/ExamUnavailable.vue'
import FinishDialog from '../components/FinishDialog.vue'
import QuestionNav from '../components/QuestionNav.vue'
import QuestionView from '../components/QuestionView.vue'
import { useExamStore } from '../exam.store'

const route = useRoute()
const router = useRouter()
const exam = useExamStore()
const attemptId = computed(() => String(route.params.attemptId))
const confirming = ref(false)
const loadError = ref(false)

async function open(id: string) {
  loadError.value = false
  try {
    await exam.open(id)
  } catch {
    loadError.value = true
  }
}
watch(attemptId, open, { immediate: true })

// Leaving for the "done" page keeps the session running: it still has to deliver answers and recordings.
watch(
  () => exam.locked,
  (locked) => locked && router.replace(`/attempts/${attemptId.value}/done`),
)
onUnmounted(() => {
  if (!exam.locked) exam.close()
})

const unanswered = computed(() => exam.questions.length - exam.answeredCount)

function confirmFinish() {
  confirming.value = false
  void exam.finish()
}
</script>

<template>
  <ExamUnavailable v-if="loadError" reason="load" @retry="open(attemptId)" />
  <ExamUnavailable v-else-if="exam.openedElsewhere" reason="elsewhere" />

  <div v-else-if="exam.attempt && exam.question" class="exam">
    <ExamHeader
      :title="exam.attempt.exam.title"
      :step="$t('exam.header.step', { n: exam.current + 1, total: exam.questions.length })"
      :remaining-ms="exam.remainingMs"
      :finishing="exam.locked"
      @finish="confirming = true"
    />
    <ExamNotices
      :attempt-id="attemptId"
      :signed-out="exam.signedOut"
      :save-failed="exam.saveFailed"
      :chain-broken="exam.chainBroken"
    />
    <HintBanner />

    <div class="body">
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

    <FinishDialog
      :open="confirming"
      :unanswered="unanswered"
      @confirm="confirmFinish"
      @cancel="confirming = false"
    />
    <ExaminerMessage :message="exam.warning" @close="exam.warning = null" />
  </div>
</template>

<style scoped>
.exam {
  display: grid;
  gap: var(--space-4);
  min-height: 100dvh;
  padding: var(--space-4);
  align-content: start;
}
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
