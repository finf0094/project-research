<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAction } from '@/shared/lib/use-action'
import { StatTile } from '@/shared/ui'
import { publishResults } from '../api'
import GradeSheet from '../components/GradeSheet.vue'
import PublishCard from '../components/PublishCard.vue'
import ScoreChart from '../components/ScoreChart.vue'
import { useExamHub } from '../exam-hub'
import { PASS_SCORE } from '@exam/contracts'
import { finalScore } from '../exam-state'
import { distribution, gradeSheetCsv, outcome } from '../grade-sheet'

/** After the exam: averages, the distribution, publishing to students and the grade sheet. */
const { examId, exam, attempts, now, refresh } = useExamHub()
const { t, locale } = useI18n()
const publishing = useAction({ 409: 'hub.results.notOver' as const })
// The review shows correct answers, so results go out only once nobody can still write.
const over = computed(() => !!exam.value && now.value >= exam.value.publishableAt)

const scored = computed(() => attempts.value.map(finalScore).filter((s) => s !== null))
// Nothing scored yet has no average: a zero would read as a result.
const average = computed(() =>
  scored.value.length ? Math.round(scored.value.reduce((s, x) => s + x, 0) / scored.value.length) : '—',
)
const passed = computed(() => attempts.value.filter((a) => outcome(a) === 'pass').length)
const waiting = computed(() => attempts.value.filter((a) => a.status === 'ready_for_review').length)
const violations = computed(() => attempts.value.filter((a) => a.result?.verdict === 'violation').length)

const publish = () => publishing.run(async () => (await publishResults(examId), await refresh()))

function download() {
  const csv = gradeSheetCsv(
    attempts.value,
    {
      columns: ['student', 'auto', 'max', 'score', 'result'].map((c) => t(`hub.results.columns.${c}`)),
      outcome: {
        pass: t('hub.results.verdict.pass'),
        fail: t('hub.results.verdict.fail'),
        pending: t('hub.results.verdict.pending'),
      },
    },
    locale.value === 'en' ? ',' : ';',
  )
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  link.download = `${exam.value?.title ?? 'exam'}.csv`
  link.click()
  // Revoked once the browser has started the download, not before.
  setTimeout(() => URL.revokeObjectURL(link.href), 0)
}
</script>

<template>
  <div v-if="exam" class="results">
    <section class="tiles stagger">
      <StatTile
        :label="$t('hub.results.average')"
        :value="average"
        :note="$t('hub.results.averageNote')"
        tone="ink"
      />
      <StatTile
        :label="$t('hub.results.passed')"
        :value="passed"
        :note="`${$t('hub.results.of', { n: attempts.length })} · ${$t('hub.results.passedNote', { score: PASS_SCORE })}`"
        tone="lime"
      />
      <StatTile :label="$t('hub.results.waiting')" :value="waiting" tone="peach" />
      <StatTile
        :label="$t('hub.results.violations')"
        :value="violations"
        :note="$t('hub.results.violationsNote')"
      />
    </section>
    <div class="middle">
      <ScoreChart :counts="distribution(attempts)" :total="scored.length" />
      <PublishCard
        :published-at="exam.publishedAt"
        :pending="exam.attempts.active + waiting"
        :publishing="publishing.busy.value"
        :can-publish="over"
        @publish="publish"
        @download="download"
      />
    </div>
    <p v-if="publishing.error.value" class="error" role="alert">{{ $t(publishing.error.value) }}</p>
    <GradeSheet :attempts="attempts" />
  </div>
</template>

<style scoped>
.results {
  display: grid;
  gap: var(--space-4);
}
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(150px, 100%), 1fr));
  gap: var(--space-4);
}
.middle {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  gap: var(--space-4);
}
.error {
  color: var(--danger);
}
@media (width < 1000px) {
  .middle {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
