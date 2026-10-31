<script setup lang="ts">
import { ArrowLeft, ArrowRight } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AppButton, AppCard, AppDialog } from '@/shared/ui'
import FinishDialog from '../components/FinishDialog.vue'
import ExamHeader from '../components/ExamHeader.vue'
import QuestionNav from '../components/QuestionNav.vue'
import QuestionView from '../components/QuestionView.vue'
import { useExamStore } from '../exam.store'

const route = useRoute()
const router = useRouter()
const exam = useExamStore()
const attemptId = String(route.params.attemptId)
const confirming = ref(false)
const loadError = ref(false)

onMounted(async () => {
  try {
    await exam.open(attemptId)
  } catch {
    loadError.value = true
  }
})
// Leaving for the "done" page keeps the session running: it still has to deliver answers and recordings.
onUnmounted(() => {
  if (!exam.finishing && !exam.finished) exam.close()
})

watch(
  () => exam.finishing || exam.finished,
  (done) => done && router.replace(`/attempts/${attemptId}/done`),
)

const unanswered = computed(() => exam.questions.length - exam.answeredCount)

function confirmFinish() {
  confirming.value = false
  void exam.finish()
}
</script>

<template>
  <main v-if="loadError" class="center">
    <AppCard>
      <h1>Не удалось открыть экзамен</h1>
      <p class="muted">Для первого открытия нужен интернет. Проверьте подключение и попробуйте снова.</p>
      <AppButton @click="router.go(0)">Повторить</AppButton>
    </AppCard>
  </main>

  <main v-else-if="exam.openedElsewhere" class="center">
    <AppCard>
      <h1>Экзамен открыт в другой вкладке</h1>
      <p class="muted">Продолжайте там. Закройте эту вкладку, чтобы ответы не перепутались.</p>
    </AppCard>
  </main>

  <div v-else-if="exam.attempt && exam.question" class="exam">
    <ExamHeader
      :title="exam.attempt.exam.title"
      :index="exam.current"
      :total="exam.questions.length"
      :remaining-ms="exam.remainingMs"
      :finishing="exam.finishing"
      @finish="confirming = true"
    />

    <p v-if="exam.signedOut" class="banner" role="alert">
      Сессия входа закончилась. Ответы сохраняются на устройстве —
      <RouterLink :to="`/login?next=/attempts/${attemptId}`">войдите снова</RouterLink>, чтобы они
      отправились.
    </p>

    <div class="body">
      <AppCard as="aside" class="side">
        <QuestionNav
          :questions="exam.questions"
          :answers="exam.answers"
          :current="exam.current"
          @select="exam.goTo"
        />
      </AppCard>

      <AppCard class="main">
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
            aria-label="Предыдущий вопрос"
            @click="exam.goTo(exam.current - 1)"
          >
            <ArrowLeft :size="20" />
          </AppButton>
          <AppButton v-if="exam.current < exam.questions.length - 1" @click="exam.goTo(exam.current + 1)">
            Следующий вопрос <ArrowRight :size="20" />
          </AppButton>
          <AppButton v-else variant="ink" @click="confirming = true">Сдать экзамен</AppButton>
        </footer>
      </AppCard>
    </div>

    <FinishDialog
      :open="confirming"
      :unanswered="unanswered"
      @confirm="confirmFinish"
      @cancel="confirming = false"
    />
    <AppDialog :open="!!exam.warning" title="Сообщение преподавателя" @close="exam.warning = null">
      <p>{{ exam.warning }}</p>
      <template #actions><AppButton @click="exam.warning = null">Понятно</AppButton></template>
    </AppDialog>
  </div>
</template>

<style scoped>
.exam {
  display: grid;
  gap: var(--space-4);
  min-height: 100dvh;
  padding: var(--space-4);
  grid-template-rows: auto auto 1fr;
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
.banner {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius);
  background: var(--warn-tint);
  color: var(--warn);
}
.center {
  display: grid;
  place-items: center;
  min-height: 100dvh;
  padding: var(--space-4);
  text-align: center;
}
@media (width < 900px) {
  .body {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
  .main {
    padding: var(--space-5);
  }
}
</style>
