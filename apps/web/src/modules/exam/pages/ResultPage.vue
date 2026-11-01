<script setup lang="ts">
import type { StudentResult } from '@exam/contracts'
import { MessageSquareText, ShieldAlert, ShieldCheck } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAction } from '@/shared/lib/use-action'
import { AppButton, Avatar, IconTile, PageSkeleton } from '@/shared/ui'
import { fetchResult } from '../api'
import QuestionBreakdown from '../components/QuestionBreakdown.vue'
import ScoreCard from '../components/ScoreCard.vue'

/** The published result of one attempt: score, the examiner's word, the recording verdict, each question. */
const route = useRoute()
const result = ref<StudentResult | null>(null)
const load = useAction()
onMounted(() => load.run(async () => (result.value = await fetchResult(String(route.params.attemptId)))))
</script>

<template>
  <main class="page">
    <nav class="crumbs" :aria-label="$t('app.nav.label')">
      <RouterLink to="/results">{{ $t('app.nav.results') }}</RouterLink>
    </nav>
    <p v-if="load.error.value" class="error" role="alert">{{ $t(load.error.value) }}</p>
    <PageSkeleton v-if="!result && !load.error.value" />
    <div v-if="result" class="layout">
      <aside class="side stagger">
        <ScoreCard :result="result" />
        <section v-if="result.comment" class="note">
          <header>
            <Avatar :name="result.reviewer" :size="40" />
            <div>
              <p class="title">{{ $t('student.result.comment') }}</p>
              <p class="muted small">{{ result.reviewer }}</p>
            </div>
          </header>
          <p class="comment"><MessageSquareText :size="16" aria-hidden="true" /> {{ result.comment }}</p>
        </section>
        <section class="record" :class="{ bad: result.violation }">
          <IconTile
            :icon="result.violation ? ShieldAlert : ShieldCheck"
            :tone="result.violation ? 'danger' : 'ok'"
          />
          <div>
            <p class="title">
              {{ $t(result.violation ? 'student.result.violation' : 'student.result.noRemarks') }}
            </p>
            <p class="small">
              {{ $t(result.violation ? 'student.result.violationNote' : 'student.result.noRemarksNote') }}
            </p>
          </div>
        </section>
        <AppButton variant="secondary" to="/exams">{{ $t('student.result.back') }}</AppButton>
      </aside>
      <QuestionBreakdown :questions="result.questions" />
    </div>
  </main>
</template>

<style scoped>
.layout {
  display: grid;
  grid-template-columns: minmax(300px, 400px) minmax(0, 1fr);
  gap: var(--space-4);
  align-items: start;
}
.side {
  position: sticky;
  top: var(--space-4);
  display: grid;
  gap: var(--space-4);
}
.note,
.record {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  header {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
}
.record {
  display: flex;
  background: var(--ok-tint);
  &.bad {
    background: var(--danger-tint);
  }
}
.title {
  font-weight: 700;
}
.small {
  font-size: var(--text-sm);
}
.comment {
  line-height: 1.5;
  svg {
    vertical-align: -2px;
    color: var(--text-2);
  }
}
/* The way back: a native back link on phones (app.css); wide screens have the top bar instead. */
.crumbs {
  display: none;
  @media (width < 700px) {
    display: block;
    margin-block-end: var(--space-3);
  }
}
.error {
  color: var(--danger);
}
@media (width < 900px) {
  .layout {
    grid-template-columns: 1fr;
  }
  .side {
    position: static;
  }
}
</style>
